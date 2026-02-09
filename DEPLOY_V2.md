# StorySign V2: Fresh Deployment Guide (GCP)

This guide walks you through deploying a fresh instance of StorySign Gemini on a new Google Cloud Platform (GCP) account.

## Prerequisites
- A new GCP Project with Billing Enabled ($300 credits).
- Gemnini API Key generated in the *new* project (Google AI Studio).

## Step 1: Create VM Instance
1. Go to **Compute Engine > VM Instances**.
2. Click **Create Instance**.
3. **Name**: `storysign-v2`
4. **Region**: `us-central1` (or your preferred region).
5. **Machine Type**: **`e2-medium`** (2 vCPUs, 4 GB memory) or **`e2-standard-2`** (8 GB).
   * *Recommendation*: Since you have $300 credits, use **`e2-medium`** or larger. `e2-small` (2GB RAM) often crashes during `npm run build` due to running out of memory. Save yourself the headache!
6. **Boot Disk**: 
   - OS: **Ubuntu 22.04 LTS** (x86/64).
   - Size: **30 GB** (Standard Persistent Disk) - extra space ensures Docker layers and logs don't fill up the drive.
7. **Firewall**: 
   - Check **Allow HTTP traffic**.
   - Check **Allow HTTPS traffic**.
8. Click **Create**.

## Step 2: Install Docker & Docker Compose
SSH into your new VM (click "SSH" button in console) and run:

```bash
# Update and install Docker
sudo apt-get update
sudo apt-get install -y ca-certificates curl gnupg
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

echo \
  "deb [arch=\"$(dpkg --print-architecture)\" signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo \"$VERSION_CODENAME\") stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Verify
sudo docker compose version
```

## Step 3: Clone Repository
```bash
git clone https://github.com/Start-Up-Fdn/story-sign-gemini.git
cd story-sign-gemini
```

## Step 4: Configure Environment
Create the backend environment file.

```bash
nano backend/.env
```

Paste the following (replace with your ACTUAL key):
```ini
GEMINI_API_KEY=
DATABASE_URL=postgresql://user:password@db:5432/storysign
```
*Press `Ctrl+O`, `Enter`, `Ctrl+X` to save and exit.*

## Step 5: Start Application
Build and start the containers.

```bash
sudo docker compose up -d --build
```

## Step 6: Update Log Rotation (Optional)
To prevent logs from filling up the disk:
```bash
# Add this to /etc/docker/daemon.json if needed, or rely on compose
```
(Our `docker-compose.yml` uses default logging, but for a hackathon, this is fine).

## Step 7: Access
Visit `http://<YOUR_VM_EXTERNAL_IP>` in your browser.
