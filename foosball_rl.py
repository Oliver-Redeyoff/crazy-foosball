#!/usr/bin/env python3
"""
foosball_rl.py — Train a PPO agent to control the Red team in the foosball game.

The physics simulation mirrors the browser game (Rods.tsx / Ball.tsx) as closely
as possible in a headless 2D environment so that a trained policy transfers well.

Install:
    pip install gymnasium stable-baselines3 torch numpy

Optional (ONNX export for browser inference):
    pip install onnx

Usage:
    python foosball_rl.py train           # train from scratch (~2M steps)
    python foosball_rl.py train --resume  # continue from latest checkpoint
    python foosball_rl.py eval            # watch in terminal with ASCII render
    python foosball_rl.py export          # export trained model to ONNX
"""

import argparse
import os
import time
import numpy as np
import gymnasium as gym
from gymnasium import spaces
from stable_baselines3 import PPO
from stable_baselines3.common.env_util import make_vec_env
from stable_baselines3.common.callbacks import (
    CheckpointCallback, EvalCallback, BaseCallback
)

# ─── Table constants — match src/components/Table.tsx and Rods.tsx ───────────

TABLE_W = 3.5
TABLE_L = 5.0
GOAL_W  = 1.2
HL      = TABLE_L / 2        # 2.5   half-length

# Rod Z positions (from Rods.tsx)
S     = 0.6
GK_Z  = HL - S               # 1.9
MID_Z = (HL + S / 2) / 2     # 1.4
FWD_Z = S                    # 0.6

INNER_H   = TABLE_W / 2 - 0.05   # 1.7  (from INNER_HALF in Rods.tsx)
BALL_R    = 0.20
FOOT_DIST = 0.78             # distance of foot below rod centre

SPIN_LIMIT   = np.pi * 0.55  # ~99°
MAX_SPIN_VEL = 10.0          # rad/s
RETURN_SPEED = 5.0
CHARGE_DUR   = 0.30          # seconds to reach full charge

BALL_DAMPING     = 0.6
BALL_RESTITUTION = 0.45
DT = 1 / 60.0                # simulation timestep (60 Hz)

MAX_STEPS = 1800             # 30 s at 60 Hz before episode truncates

CHECKPOINT_DIR = "./checkpoints"
LOG_DIR        = "./logs"
MODEL_PATH     = "foosball_ppo"

# ─── Rod layout ──────────────────────────────────────────────────────────────
# Each entry: (z_position, player_count)
# Mirrors the RODS array in Rods.tsx (interleaved layout).
#
#   Red  GK   z=-1.9  count=1   defends -Z goal, attacks +Z
#   Blue FWD  z=-1.4  count=2
#   Red  MID  z=-0.6  count=3
#   Blue MID  z=+0.6  count=3
#   Red  FWD  z=+1.4  count=2
#   Blue GK   z=+1.9  count=1   defends +Z goal, attacks -Z

RED_RODS  = [(-GK_Z, 1), (-FWD_Z, 3), (MID_Z, 2)]   # Red:  GK, MID, FWD
BLUE_RODS = [(-MID_Z, 2), (FWD_Z, 3), (GK_Z, 1)]    # Blue: FWD, MID, GK

# ─── Geometry helpers ─────────────────────────────────────────────────────────

def half_span(count: int) -> float:
    if count <= 1: return 0.0
    if count == 2: return INNER_H / 2
    return TABLE_W * 0.35

def slide_lim(count: int) -> float:
    return max(INNER_H - half_span(count), 0.0)

def player_x_offsets(count: int) -> list[float]:
    if count == 1: return [0.0]
    h = half_span(count)
    return [-h + (i * 2 * h) / (count - 1) for i in range(count)]

def player_xs(count: int, slide: float) -> list[float]:
    return [slide + off for off in player_x_offsets(count)]

def foot_z(rod_z: float, spin: float) -> float:
    """World-space Z of the player's foot given rod position and spin angle.

    Derived from the browser game's Euler(spin, 0, 0) rotation applied to a
    point at local (0, -FOOT_DIST, 0):
        world_z = rod_z  +  (-FOOT_DIST) * sin(spin)  *  (-1)
                = rod_z  -  FOOT_DIST * sin(spin)
    """
    return rod_z - FOOT_DIST * np.sin(spin)


# ─── Kick state-machine constants ─────────────────────────────────────────────
IDLE, CHARGING, FIRING, RETURNING = 0, 1, 2, 3

# Rod state layout: [slide, spin, phase, charge_timer]
SLIDE, SPIN, PHASE, CHARGE_T = 0, 1, 2, 3


# ─── Environment ─────────────────────────────────────────────────────────────

class FoosballEnv(gym.Env):
    """
    2D headless foosball environment.

    Observation (20 floats, normalised to ≈ [-1, 1]):
        ball_x, ball_z, ball_vx, ball_vz,
        red_gk_slide,  red_gk_spin,
        red_mid_slide, red_mid_spin,
        red_fwd_slide, red_fwd_spin,
        blue_fwd_slide, blue_fwd_spin,
        blue_mid_slide, blue_mid_spin,
        blue_gk_slide,  blue_gk_spin,
        ball_vz (sign, for direction cue)  -- repeated in normalised form
        distance_red_fwd_to_ball_x,
        distance_ball_to_blue_goal,
        time_remaining (normalised)

    Action (6 floats in [-1, 1]):
        For each of the 3 Red rods (GK, MID, FWD):
            slide_target  — normalised position to move to
            kick_trigger  — > 0.5 means "start a kick if idle"
    """

    metadata = {"render_modes": ["ansi"]}

    def __init__(self, opponent_holder=None, render_mode=None):
        super().__init__()
        # opponent_holder is a shared OpponentHolder; policy=None → rule-based
        self.opponent_holder = opponent_holder
        self.render_mode = render_mode

        n_obs = 4 + 2 * (len(RED_RODS) + len(BLUE_RODS)) + 4
        self.observation_space = spaces.Box(
            low=-1.0, high=1.0, shape=(n_obs,), dtype=np.float32
        )
        self.action_space = spaces.Box(
            low=-1.0, high=1.0, shape=(len(RED_RODS) * 2,), dtype=np.float32
        )
        self._reset_arrays()

    def _reset_arrays(self):
        self.ball_x  = 0.0
        self.ball_z  = 0.0
        self.ball_vx = 0.0
        self.ball_vz = 0.0

        # shape (n_rods, 4): [slide, spin, phase, charge_timer]
        self.red_state  = np.zeros((len(RED_RODS),  4), dtype=np.float32)
        self.blue_state = np.zeros((len(BLUE_RODS), 4), dtype=np.float32)

        self.steps      = 0
        self.red_score  = 0
        self.blue_score = 0

    def reset(self, *, seed=None, options=None):
        super().reset(seed=seed)
        self._reset_arrays()
        angle = self.np_random.uniform(0, 2 * np.pi)
        speed = self.np_random.uniform(0.3, 0.7)
        self.ball_vx = np.cos(angle) * speed
        self.ball_vz = np.sin(angle) * speed
        return self._obs(), {}

    # ── Observation ──────────────────────────────────────────────────────────

    def _obs(self) -> np.ndarray:
        obs = [
            self.ball_x  / (TABLE_W / 2),
            self.ball_z  / HL,
            np.clip(self.ball_vx / 5.0, -1, 1),
            np.clip(self.ball_vz / 5.0, -1, 1),
        ]
        for i, (rod_z, count) in enumerate(RED_RODS):
            lim = slide_lim(count)
            obs.append(self.red_state[i, SLIDE] / lim if lim > 0 else 0.0)
            obs.append(self.red_state[i, SPIN]  / SPIN_LIMIT)
        for i, (rod_z, count) in enumerate(BLUE_RODS):
            lim = slide_lim(count)
            obs.append(self.blue_state[i, SLIDE] / lim if lim > 0 else 0.0)
            obs.append(self.blue_state[i, SPIN]  / SPIN_LIMIT)

        # Extra features: direction cue, proximity to blue goal, time
        fwd_rod_z, fwd_count = RED_RODS[2]   # Red FWD
        fwd_slide = self.red_state[2, SLIDE]
        nearest_px = min(player_xs(fwd_count, fwd_slide), key=lambda px: abs(px - self.ball_x))
        obs.append(np.clip((nearest_px - self.ball_x) / (TABLE_W / 2), -1, 1))
        obs.append(np.clip(self.ball_vz / 5.0, -1, 1))          # direction emphasis
        obs.append((HL - self.ball_z) / (2 * HL))               # distance to blue goal
        obs.append(1.0 - self.steps / MAX_STEPS)                 # time remaining

        arr = np.array(obs, dtype=np.float32)
        arr = np.nan_to_num(arr, nan=0.0, posinf=1.0, neginf=-1.0)
        return np.clip(arr, -1.0, 1.0)

    # ── Step ─────────────────────────────────────────────────────────────────

    def step(self, action):
        self.steps += 1

        # Apply Red team actions
        for i, (rod_z, count) in enumerate(RED_RODS):
            slide_norm   = float(np.clip(action[i * 2], -1, 1))
            kick_trigger = float(action[i * 2 + 1]) > 0.5

            lim    = slide_lim(count)
            target = slide_norm * lim
            self.red_state[i, SLIDE] += (target - self.red_state[i, SLIDE]) * min(1.0, 8.0 * DT)
            self.red_state[i, SLIDE]  = np.clip(self.red_state[i, SLIDE], -lim, lim)

            _kick_step(self.red_state[i], kick_trigger, team_sign=+1)

        # Blue team (rule-based or trained policy via shared holder)
        blue_policy = self.opponent_holder.policy if self.opponent_holder else None
        if blue_policy is not None:
            blue_obs = self._blue_obs()
            blue_action, _ = blue_policy.predict(blue_obs, deterministic=True)
            self._apply_blue_action(blue_action)
        else:
            self._rule_based_blue()

        reward, terminated = self._physics_step()
        truncated = self.steps >= MAX_STEPS

        if self.render_mode == "ansi":
            self.render()

        return self._obs(), reward, terminated, truncated, {}

    def _apply_blue_action(self, action):
        action = np.nan_to_num(np.asarray(action, dtype=np.float32), nan=0.0)
        for i, (rod_z, count) in enumerate(BLUE_RODS):
            slide_norm   = float(np.clip(action[i * 2], -1, 1))
            kick_trigger = float(action[i * 2 + 1]) > 0.5
            lim    = slide_lim(count)
            target = slide_norm * lim
            self.blue_state[i, SLIDE] += (target - self.blue_state[i, SLIDE]) * min(1.0, 8.0 * DT)
            self.blue_state[i, SLIDE]  = np.clip(self.blue_state[i, SLIDE], -lim, lim)
            _kick_step(self.blue_state[i], kick_trigger, team_sign=-1)

    def _rule_based_blue(self):
        bx, bz = self.ball_x, self.ball_z
        for i, (rod_z, count) in enumerate(BLUE_RODS):
            lim    = slide_lim(count)
            h      = half_span(count)
            target = np.clip((bx - h) if bx >= 0 else (bx + h), -lim, lim)
            self.blue_state[i, SLIDE] += (target - self.blue_state[i, SLIDE]) * min(1.0, 3.5 * DT)
            self.blue_state[i, SLIDE]  = np.clip(self.blue_state[i, SLIDE], -lim, lim)

            near_z   = abs(bz - rod_z) < 0.45
            pxs      = player_xs(count, self.blue_state[i, SLIDE])
            aligned  = any(abs(px - bx) < 0.35 for px in pxs)
            trigger  = near_z and aligned and self.blue_state[i, PHASE] == IDLE
            _kick_step(self.blue_state[i], trigger, team_sign=-1)

    def _blue_obs(self) -> np.ndarray:
        """Mirror observation for Blue — flip ball_z, swap rod states."""
        obs = [
            self.ball_x  / (TABLE_W / 2),
            -self.ball_z / HL,                       # flipped
            np.clip(self.ball_vx / 5.0, -1, 1),
            np.clip(-self.ball_vz / 5.0, -1, 1),     # flipped
        ]
        for i, (rod_z, count) in enumerate(BLUE_RODS):
            lim = slide_lim(count)
            obs.append(self.blue_state[i, SLIDE] / lim if lim > 0 else 0.0)
            obs.append(-self.blue_state[i, SPIN] / SPIN_LIMIT)
        for i, (rod_z, count) in enumerate(RED_RODS):
            lim = slide_lim(count)
            obs.append(self.red_state[i, SLIDE] / lim if lim > 0 else 0.0)
            obs.append(-self.red_state[i, SPIN] / SPIN_LIMIT)

        fwd_slide = self.blue_state[2, SLIDE]
        _, fwd_count = BLUE_RODS[2]
        nearest_px = min(player_xs(fwd_count, fwd_slide), key=lambda px: abs(px - self.ball_x))
        obs.append(np.clip((nearest_px - self.ball_x) / (TABLE_W / 2), -1, 1))
        obs.append(np.clip(-self.ball_vz / 5.0, -1, 1))
        obs.append((HL + self.ball_z) / (2 * HL))
        obs.append(1.0 - self.steps / MAX_STEPS)

        arr = np.array(obs, dtype=np.float32)
        arr = np.nan_to_num(arr, nan=0.0, posinf=1.0, neginf=-1.0)
        return np.clip(arr, -1.0, 1.0)

    # ── Physics ──────────────────────────────────────────────────────────────

    def _physics_step(self) -> tuple[float, bool]:
        reward = 0.0
        bx, bz = self.ball_x, self.ball_z
        vx, vz = self.ball_vx, self.ball_vz

        # Red kick contacts
        for i, (rod_z, count) in enumerate(RED_RODS):
            if self.red_state[i, PHASE] == FIRING:
                spin = self.red_state[i, SPIN]
                fz   = foot_z(rod_z, spin)
                for px in player_xs(count, self.red_state[i, SLIDE]):
                    if abs(bz - fz) < (BALL_R + 0.12) and abs(bx - px) < (BALL_R + 0.15):
                        # Foot velocity toward +Z during red firing
                        foot_vel_z = FOOT_DIST * MAX_SPIN_VEL * np.cos(spin)
                        vz += foot_vel_z * DT * 4.0
                        vx += (bx - px) * 0.8
                        reward += 0.4

        # Blue kick contacts
        for i, (rod_z, count) in enumerate(BLUE_RODS):
            if self.blue_state[i, PHASE] == FIRING:
                spin = self.blue_state[i, SPIN]
                fz   = foot_z(rod_z, spin)
                for px in player_xs(count, self.blue_state[i, SLIDE]):
                    if abs(bz - fz) < (BALL_R + 0.12) and abs(bx - px) < (BALL_R + 0.15):
                        foot_vel_z = -FOOT_DIST * MAX_SPIN_VEL * np.cos(spin)
                        vz += foot_vel_z * DT * 4.0
                        vx += (bx - px) * 0.8

        # Cap velocity to prevent overflow from multiple simultaneous contacts
        vx = np.clip(vx, -15.0, 15.0)
        vz = np.clip(vz, -15.0, 15.0)

        # Damping
        vx *= (1.0 - BALL_DAMPING * DT)
        vz *= (1.0 - BALL_DAMPING * DT)

        bx += vx * DT
        bz += vz * DT

        # NaN safety — reset ball to centre if physics produced bad values
        if not np.isfinite(bx) or not np.isfinite(bz):
            bx = bz = vx = vz = 0.0

        # Side walls
        wall_x = TABLE_W / 2 - BALL_R
        if abs(bx) > wall_x:
            bx  = np.sign(bx) * wall_x
            vx *= -BALL_RESTITUTION

        # End walls / goals
        terminated = False
        if abs(bz) > HL - BALL_R:
            if abs(bx) < GOAL_W / 2:
                if bz > 0:          # Red scored (Blue goal)
                    reward += 10.0
                    self.red_score += 1
                else:               # Blue scored (Red goal)
                    reward -= 10.0
                    self.blue_score += 1
                terminated = True
            else:
                bz  = np.sign(bz) * (HL - BALL_R)
                vz *= -BALL_RESTITUTION

        # Dense reward shaping
        reward += vz * 0.003                         # ball moving toward Blue goal
        reward += max(0, -abs(bx) + TABLE_W / 4) * 0.0002  # prefer ball in centre lane
        reward -= 0.001                              # small step cost

        self.ball_x, self.ball_z   = bx, bz
        self.ball_vx, self.ball_vz = vx, vz
        return reward, terminated

    # ── Render ───────────────────────────────────────────────────────────────

    def render(self):
        W, H = 60, 20
        grid = [[" "] * W for _ in range(H)]

        def to_col(x):  return int((x / (TABLE_W / 2) + 1) / 2 * (W - 1))
        def to_row(z):  return int((-z / HL + 1) / 2 * (H - 1))

        # Walls
        for c in range(W): grid[0][c] = grid[H-1][c] = "─"
        for r in range(H): grid[r][0]  = grid[r][W-1]  = "│"

        # Goals
        goal_cols = range(to_col(-GOAL_W/2), to_col(GOAL_W/2) + 1)
        for c in goal_cols: grid[0][c] = "B"   # Blue goal (top = +Z)
        for c in goal_cols: grid[H-1][c] = "R" # Red goal  (bot = -Z)

        # Rods
        for rod_z, count in RED_RODS:
            r = to_row(rod_z)
            if 0 <= r < H:
                for c in range(W): grid[r][c] = "·"

        for rod_z, count in BLUE_RODS:
            r = to_row(rod_z)
            if 0 <= r < H:
                for c in range(W): grid[r][c] = "·"

        # Players
        for i, (rod_z, count) in enumerate(RED_RODS):
            r = to_row(rod_z)
            for px in player_xs(count, self.red_state[i, SLIDE]):
                c = to_col(px)
                if 0 <= r < H and 0 <= c < W: grid[r][c] = "R"

        for i, (rod_z, count) in enumerate(BLUE_RODS):
            r = to_row(rod_z)
            for px in player_xs(count, self.blue_state[i, SLIDE]):
                c = to_col(px)
                if 0 <= r < H and 0 <= c < W: grid[r][c] = "B"

        # Ball
        br = to_row(self.ball_z)
        bc = to_col(self.ball_x)
        if 0 <= br < H and 0 <= bc < W:
            grid[br][bc] = "O"

        print(f"\n  Red {self.red_score} : {self.blue_score} Blue   step {self.steps}")
        for row in grid:
            print("".join(row))


# ─── Kick state machine (shared by both teams) ───────────────────────────────

def _kick_step(state: np.ndarray, trigger: bool, team_sign: int):
    """
    Update one rod's kick state machine for one timestep.
    team_sign: +1 for Red (attacks +Z), -1 for Blue (attacks -Z).
    Mutates state in-place.
    """
    phase = int(state[PHASE])

    if phase == IDLE:
        if trigger:
            state[PHASE]    = CHARGING
            state[CHARGE_T] = 0.0

    elif phase == CHARGING:
        state[CHARGE_T] += DT
        progress = min(state[CHARGE_T] / CHARGE_DUR, 1.0)
        # Wind-up: Red charges +spin, Blue charges -spin
        state[SPIN] = team_sign * progress * SPIN_LIMIT
        if state[CHARGE_T] >= CHARGE_DUR:
            state[PHASE] = FIRING

    elif phase == FIRING:
        # Fire toward -team_sign direction at constant speed
        state[SPIN] -= team_sign * MAX_SPIN_VEL * DT
        if team_sign > 0 and state[SPIN] <= -SPIN_LIMIT:
            state[SPIN]  = -SPIN_LIMIT
            state[PHASE] = RETURNING
        elif team_sign < 0 and state[SPIN] >= SPIN_LIMIT:
            state[SPIN]  = SPIN_LIMIT
            state[PHASE] = RETURNING

    elif phase == RETURNING:
        state[SPIN] *= max(0.0, 1.0 - RETURN_SPEED * DT)
        if abs(state[SPIN]) < 0.01:
            state[SPIN]  = 0.0
            state[PHASE] = IDLE


# ─── Shared opponent holder ───────────────────────────────────────────────────

class OpponentHolder:
    """Mutable reference to the Blue opponent policy shared across all envs.
    Setting holder.policy to None falls back to the rule-based opponent."""
    def __init__(self):
        self.policy = None


# ─── Self-play callback ───────────────────────────────────────────────────────

class SelfPlayCallback(BaseCallback):
    """
    Every `swap_freq` steps, snapshot the current policy and make it the Blue
    opponent by updating the shared OpponentHolder.  The swap happens at rollout
    boundaries (on_rollout_end) so the rollout buffer is never mid-flight.
    """

    def __init__(self, holder: OpponentHolder, swap_freq: int = 300_000, verbose: int = 1):
        super().__init__(verbose)
        self.holder     = holder
        self.swap_freq  = swap_freq
        self._next_swap = swap_freq   # relative to training start, handled below

    def _on_step(self) -> bool:
        return True   # nothing per-step

    def on_rollout_end(self) -> None:
        if self.num_timesteps < self._next_swap:
            return
        self._next_swap = self.num_timesteps + self.swap_freq
        snapshot_path = f"{CHECKPOINT_DIR}/selfplay_{self.num_timesteps}"
        self.model.save(snapshot_path)
        self.holder.policy = PPO.load(snapshot_path)
        if self.verbose:
            print(f"\n[SelfPlay] Swapped Blue opponent at step {self.num_timesteps}")


# ─── Train ───────────────────────────────────────────────────────────────────

def train(resume: bool = False):
    os.makedirs(CHECKPOINT_DIR, exist_ok=True)
    os.makedirs(LOG_DIR, exist_ok=True)

    n_envs  = min(8, os.cpu_count() or 4)
    holder  = OpponentHolder()
    vec_env = make_vec_env(lambda: FoosballEnv(opponent_holder=holder), n_envs=n_envs)

    if resume and os.path.exists(f"{MODEL_PATH}.zip"):
        print(f"Resuming from {MODEL_PATH}.zip")
        model = PPO.load(MODEL_PATH, env=vec_env)
    else:
        model = PPO(
            "MlpPolicy",
            vec_env,
            learning_rate=3e-4,
            n_steps=2048,
            batch_size=512,
            n_epochs=10,
            gamma=0.99,
            gae_lambda=0.95,
            clip_range=0.2,
            ent_coef=0.01,         # encourage exploration
            vf_coef=0.5,
            max_grad_norm=0.5,
            policy_kwargs=dict(net_arch=[256, 256, 128]),
            verbose=1,
        )

    callbacks = [
        CheckpointCallback(
            save_freq=max(50_000 // n_envs, 1),
            save_path=CHECKPOINT_DIR,
            name_prefix="foosball",
        ),
        EvalCallback(
            FoosballEnv(),          # eval env has no opponent holder — uses rule-based
            eval_freq=max(20_000 // n_envs, 1),
            n_eval_episodes=20,
            verbose=1,
        ),
        SelfPlayCallback(holder, swap_freq=300_000),
    ]

    print(f"Training on {n_envs} parallel envs.")
    model.learn(total_timesteps=3_000_000, callback=callbacks, reset_num_timesteps=not resume)
    model.save(MODEL_PATH)
    print(f"\nDone. Model saved to {MODEL_PATH}.zip")


# ─── Eval ────────────────────────────────────────────────────────────────────

def eval_agent(episodes: int = 5):
    if not os.path.exists(f"{MODEL_PATH}.zip"):
        print(f"No model found at {MODEL_PATH}.zip — train first.")
        return

    model = PPO.load(MODEL_PATH)
    env   = FoosballEnv(render_mode="ansi")

    for ep in range(episodes):
        obs, _ = env.reset()
        total_reward = 0.0
        done = False
        while not done:
            action, _ = model.predict(obs, deterministic=True)
            obs, reward, terminated, truncated, _ = env.step(action)
            total_reward += reward
            done = terminated or truncated
            time.sleep(DT / 4)   # play at ~4× real-time in terminal
        print(f"Episode {ep+1}: reward={total_reward:.1f}  score Red {env.red_score} – {env.blue_score} Blue")


# ─── ONNX Export ─────────────────────────────────────────────────────────────

def export_onnx():
    """
    Export the trained policy network to ONNX so it can be loaded in the browser
    via onnxruntime-web and called from Rods.tsx instead of the rule-based AI.

    Requires:  pip install onnx
    Browser:   npm install onnxruntime-web
    """
    try:
        import torch
    except ImportError:
        print("PyTorch not found — install with: pip install torch")
        return

    try:
        import onnx  # noqa: F401
    except ImportError:
        print("onnx not found — install with: pip install onnx")
        return

    if not os.path.exists(f"{MODEL_PATH}.zip"):
        print(f"No model found at {MODEL_PATH}.zip — train first.")
        return

    model = PPO.load(MODEL_PATH)
    policy = model.policy
    policy.eval()

    obs_dim    = model.observation_space.shape[0]
    dummy_obs  = torch.zeros(1, obs_dim)
    export_path = f"{MODEL_PATH}.onnx"

    torch.onnx.export(
        policy,
        dummy_obs,
        export_path,
        input_names=["obs"],
        output_names=["action", "value", "log_prob"],
        opset_version=17,
        dynamic_axes={"obs": {0: "batch"}},
    )
    print(f"Exported to {export_path}")
    print()
    print("Browser usage (Rods.tsx):")
    print("  import * as ort from 'onnxruntime-web'")
    print("  const session = await ort.InferenceSession.create('./foosball_ppo.onnx')")
    print("  const obs = new ort.Tensor('float32', obsArray, [1, obs_dim])")
    print("  const { action } = await session.run({ obs })")
    print("  // action.data is Float32Array of length 6")


# ─── Entry point ─────────────────────────────────────────────────────────────

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Foosball RL trainer")
    sub    = parser.add_subparsers(dest="cmd")

    train_p = sub.add_parser("train",  help="Train a new agent (or resume)")
    train_p.add_argument("--resume", action="store_true", help="Continue from saved model")

    sub.add_parser("eval",   help="Watch trained agent in terminal")
    sub.add_parser("export", help="Export model to ONNX for browser use")

    args = parser.parse_args()

    if args.cmd == "train":
        train(resume=getattr(args, "resume", False))
    elif args.cmd == "eval":
        eval_agent()
    elif args.cmd == "export":
        export_onnx()
    else:
        parser.print_help()
