import os
import csv
import uuid
import gymnasium as gym
from stable_baselines3 import PPO
from stable_baselines3.common.env_checker import check_env
from network_echo_env import NetworkEchoEnv
import numpy as np
from stable_baselines3.common.env_util import make_vec_env

LOG_PATH = os.path.join(os.path.dirname(__file__), 'analysis_log.csv')
MODEL_PATH = os.path.join(os.path.dirname(__file__), 'ppo_networkecho.zip')

# --- CURRICULUM LEARNING ---
from pathlib import Path

STAGE1_STEPS = 100000
STAGE2_STEPS = 100000
STAGE3_STEPS = 100000

# CSV логгер
def log_episode(session_id, win, reason, score, steps, trace, final_stats=None):
    file_exists = os.path.isfile(LOG_PATH)
    with open(LOG_PATH, 'a', newline='') as csvfile:
        writer = csv.writer(csvfile)
        if not file_exists:
            writer.writerow([
                'session_id', 'win', 'reason_for_end', 'final_score', 'total_steps', 'final_trace_level',
                'program_counts', 'avg_levels', 'enemies_killed', 'total_dp', 'total_cpu'])
        row = [session_id, win, reason, score, steps, trace]
        if final_stats:
            row.append(str(final_stats.get('program_counts', {})))
            row.append(str(final_stats.get('avg_levels', {})))
            row.append(final_stats.get('enemies_killed', 0))
            row.append(final_stats.get('total_dp', 0))
            row.append(final_stats.get('total_cpu', 0))
        else:
            row += ['', '', '', '', '']
        writer.writerow(row)

# Stage 1: Economy tutorial
print('Stage 1: Economy tutorial')
econ_env = NetworkEchoEnv(config={'mode': 'economy_tutorial'})
check_env(econ_env, warn=True)
model1 = PPO('MlpPolicy', econ_env, verbose=1)
steps = 0
while steps < STAGE1_STEPS:
    obs, info = econ_env.reset()
    done = False
    ep_reward = 0
    ep_steps = 0
    session_id = str(uuid.uuid4())
    while not done:
        action, _ = model1.predict(obs, deterministic=False)
        obs, reward, done, truncated, info = econ_env.step(action)
        ep_reward += reward
        ep_steps += 1
        steps += 1
        if steps >= STAGE1_STEPS:
            break
    win = int(ep_reward > 0)
    reason = 'win' if win else 'loss_or_timeout'
    final_trace = obs[2] if len(obs) > 2 else 0
    final_stats = info.get('final_stats') if isinstance(info, dict) else None
    log_episode(session_id, win, reason, ep_reward, ep_steps, final_trace, final_stats)
    print(f"Episode {steps}: reward={ep_reward}, steps={ep_steps}, trace={final_trace}, stats={final_stats}")
    if steps >= STAGE1_STEPS:
        break
model1.save('ppo_economy_trained.zip')

# Stage 2: Defense tutorial
print('Stage 2: Defense tutorial')
def_env = NetworkEchoEnv(config={'mode': 'defense_tutorial'})
check_env(def_env, warn=True)
model2 = PPO.load('ppo_economy_trained.zip', env=def_env, verbose=1)
steps = 0
while steps < STAGE2_STEPS:
    obs, info = def_env.reset()
    done = False
    ep_reward = 0
    ep_steps = 0
    session_id = str(uuid.uuid4())
    while not done:
        action, _ = model2.predict(obs, deterministic=False)
        obs, reward, done, truncated, info = def_env.step(action)
        ep_reward += reward
        ep_steps += 1
        steps += 1
        if steps >= STAGE2_STEPS:
            break
    win = int(ep_reward > 0)
    reason = 'win' if win else 'loss_or_timeout'
    final_trace = obs[2] if len(obs) > 2 else 0
    final_stats = info.get('final_stats') if isinstance(info, dict) else None
    log_episode(session_id, win, reason, ep_reward, ep_steps, final_trace, final_stats)
    print(f"Episode {steps}: reward={ep_reward}, steps={ep_steps}, trace={final_trace}, stats={final_stats}")
    if steps >= STAGE2_STEPS:
        break
model2.save('ppo_defense_trained.zip')

# Stage 3: Full game
print('Stage 3: Full game')
full_env = NetworkEchoEnv()
check_env(full_env, warn=True)
model3 = PPO.load('ppo_defense_trained.zip', env=full_env, verbose=1)
steps = 0
while steps < STAGE3_STEPS:
    obs, info = full_env.reset()
    done = False
    ep_reward = 0
    ep_steps = 0
    session_id = str(uuid.uuid4())
    while not done:
        action, _ = model3.predict(obs, deterministic=False)
        obs, reward, done, truncated, info = full_env.step(action)
        ep_reward += reward
        ep_steps += 1
        steps += 1
        if steps >= STAGE3_STEPS:
            break
    win = int(ep_reward > 0)
    reason = 'win' if win else 'loss_or_timeout'
    final_trace = obs[2] if len(obs) > 2 else 0
    final_stats = info.get('final_stats') if isinstance(info, dict) else None
    log_episode(session_id, win, reason, ep_reward, ep_steps, final_trace, final_stats)
    print(f"Episode {steps}: reward={ep_reward}, steps={ep_steps}, trace={final_trace}, stats={final_stats}")
    if steps >= STAGE3_STEPS:
        break
model3.save('ppo_networkecho.zip')
print('Curriculum training complete.')

print(f"Training complete. Results saved to {LOG_PATH}, model saved to {MODEL_PATH}") 