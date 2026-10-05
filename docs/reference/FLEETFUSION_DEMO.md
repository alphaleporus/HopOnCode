# 🎬 FleetFusion Demo Guide

Complete guide for running and presenting the FleetFusion demo.

## 🚀 Quick Start

### One-Command Demo Launch

```bash
./start-demo.sh
```

This script will:

- ✅ Check all prerequisites (Node.js, Python, npm)
- ✅ Install dependencies if missing
- ✅ Create Python virtual environment if needed
- ✅ Start Pathway streaming pipeline
- ✅ Start WebSocket server
- ✅ Start Next.js frontend
- ✅ Monitor all services
- ✅ Gracefully shutdown on Ctrl+C

### Manual Start (Step by Step)

If you prefer to start services individually:

#### 1. Start Backend Services

```bash
# Terminal 1: Pathway Pipeline
cd backend-pathway
source venv-pathway/bin/activate
python main.py
```

```bash
# Terminal 2: WebSocket Server
cd backend-pathway
source venv-pathway/bin/activate
python websocket_server.py
```

#### 2. Start Frontend

```bash
# Terminal 3: Next.js Frontend
npm run dev
```

## 📋 Prerequisites

### Required Software

- **Node.js** 18+ and npm
- **Python** 3.12+
- **Git**

### Installation Check

Run these commands to verify:

```bash
node --version    # Should be v18 or higher
python3 --version # Should be 3.12 or higher
npm --version     # Should be 8 or higher
```

### Dependencies

#### Frontend Dependencies

```bash
npm install
```

#### Backend Dependencies

```bash
cd backend-pathway
python3 -m venv venv-pathway
source venv-pathway/bin/activate
pip install -r requirements-pathway.txt
```

## ⚙️ Configuration

### Environment Variables

Create `backend-pathway/.env`:

```bash
# OpenAI API Key (required for AI features)
OPENAI_API_KEY=sk-your-api-key-here

# WebSocket Configuration
WEBSOCKET_PORT=8765
WEBSOCKET_HOST=localhost

# GPS Update Frequency (seconds)
GPS_UPDATE_INTERVAL=1
```

### Optional Configuration

Create `.env.local` in project root:

```bash
# Only needed if using authentication
NEXTAUTH_SECRET=your-secret-key
NEXTAUTH_URL=http://localhost:3000

# WebSocket URL
NEXT_PUBLIC_WS_URL=ws://localhost:8765
```

## 🎯 Demo Scenario

### Timeline (Auto-runs when started)

```
T+0s  : 🚀 System initialized, 3 trucks loaded
        • TRK-402: Pune → Mumbai (Priya Sharma)
        • TRK-301: Bangalore → Delhi (Rajesh Kumar)
        • TRK-205: Mumbai → Kolkata (Anita Desai)

T+2s  : 📡 All trucks reporting GPS (🟢 ON-TIME)
        Velocities: 68 km/h, 72 km/h, 65 km/h

T+5s  : 🟡 TRK-402 velocity drops to 0 km/h
        Status: ON-TIME → DELAYED

T+8s  : 🔴 TRK-402 stopped for >180 seconds
        Status: DELAYED → CRITICAL
        AI calculates: $2,500 penalty incoming

T+10s : 💡 Arbitrage opportunity detected
        Alternative supplier: $800 cost
        Net savings: $1,700

T+12s : 💜 User executes fix → Confetti! 🎉
        Status: CRITICAL → RESOLVED
```

## 🖥️ Access Points

Once all services are running:

| Service | URL | Description |
|---------|-----|-------------|
| **Landing Page** | http://localhost:3000 | Main entry point |
| **Dashboard** | http://localhost:3000/dashboard | Live map & agent stream |
| **Analytics** | http://localhost:3000/analytics | Metrics & trends |
| **Login** | http://localhost:3000/login | Authentication page |
| **Tracking** | http://localhost:3000/track/TRK-402 | Public tracking |
| **WebSocket** | ws://localhost:8765 | Real-time data stream |

## 🎤 Demo Presentation Flow

### 1. Landing Page (30 seconds)

**Show:**

- Modern dark UI with glassmorphism
- Auto-updating 24h metrics
- Feature highlights

**Talk Points:**

- "FleetFusion monitors supply chains in real-time"
- "See these metrics? They update every second"
- "Built with Pathway streaming engine for sub-second latency"

### 2. Dashboard - Map View (60 seconds)

**Show:**

- 3 trucks with real-time GPS tracking
- OSRM road routing (not straight lines)
- Status color changes: 🟢 → 🟡 → 🔴

**Talk Points:**

- "Here's our live map with 3 active deliveries"
- "These are real road routes from OSRM API"
- "Watch TRK-402 - it's about to encounter a problem"
- "See the color change? That's our AI detecting delays"

### 3. Delay Detection (45 seconds)

**Show:**

- Velocity drop in real-time
- Temporal windows in action
- Agent stream logging events

**Talk Points:**

- "Our Pathway pipeline uses 60-second sliding windows"
- "It detected the velocity drop immediately"
- "See the agent stream? That's real-time event processing"
- "This is all happening in streaming mode - no batch processing"

### 4. AI Contract Analysis (60 seconds)

**Show:**

- Contract analysis in progress
- Penalty calculation
- Arbitrage opportunity modal

**Talk Points:**

- "Now the AI is analyzing the contract with RAG"
- "It calculated a $2,500 penalty if we're late"
- "But it found an alternative supplier for just $800"
- "Net savings: $1,700 - that's the power of AI arbitrage"

### 5. One-Click Resolution (30 seconds)

**Show:**

- Execute fix button
- Confetti animation
- Status change to RESOLVED (💜)

**Talk Points:**

- "Watch this - one click to execute the fix"
- "Confetti! Because saving $1,700 deserves celebration"
- "The truck is now marked as resolved"
- "Relief vehicle automatically dispatched"

### 6. Analytics Deep Dive (30 seconds)

**Show:**

- Analytics dashboard
- Charts and metrics
- Export functionality

**Talk Points:**

- "Here's our analytics dashboard"
- "Real-time metrics with historical trends"
- "Everything exportable to CSV"
- "Built for enterprise decision-making"

## 🎬 Demo Tips

### Before You Start

1. ✅ Clear browser cache
2. ✅ Close unnecessary browser tabs
3. ✅ Increase browser zoom to 125% for visibility
4. ✅ Open dashboard in incognito mode (fresh state)
5. ✅ Have backup slides ready
6. ✅ Test screen sharing setup

### During Demo

1. 🗣️ **Narrate continuously** - Don't let silence happen
2. 👆 **Point with cursor** - Show what you're talking about
3. ⏱️ **Watch timing** - TRK-402 delay happens at T+5s
4. 🎯 **Focus on value** - Emphasize cost savings and automation
5. 📊 **Show technical depth** - Mention Pathway, temporal windows, RAG

### Common Issues

#### Issue: "Services won't start"

**Solution:**

```bash
# Kill any existing processes
pkill -f "python main.py"
pkill -f "python websocket_server.py"
pkill -f "next dev"

# Clean restart
./start-demo.sh
```

#### Issue: "Trucks not moving on map"

**Solution:**

- Check browser console for WebSocket errors
- Verify WebSocket server is running: `lsof -i :8765`
- Refresh browser page

#### Issue: "No arbitrage modal appearing"

**Solution:**

- OpenAI API key might be missing
- Check `backend-pathway/.env` file
- Verify OpenAI API credits

#### Issue: "Frontend won't load"

**Solution:**

```bash
# Reinstall dependencies
rm -rf node_modules .next
npm install
npm run dev
```

## 📊 Monitoring During Demo

### Check Service Status

```bash
# View logs in real-time
tail -f logs/pathway.log      # Pathway pipeline
tail -f logs/websocket.log    # WebSocket server
tail -f logs/frontend.log     # Next.js frontend
```

### Check Process Health

```bash
# List all demo processes
cat .demo-pids | xargs ps -p

# Check specific ports
lsof -i :3000  # Frontend
lsof -i :8765  # WebSocket
```

## 🛑 Stopping the Demo

### Using the Script

If you started with `./start-demo.sh`:

```bash
# Simply press Ctrl+C
# Script will clean up all processes automatically
```

### Manual Cleanup

If you need to force stop:

```bash
# Kill all related processes
pkill -f "python main.py"
pkill -f "python websocket_server.py"
pkill -f "next dev"

# Remove PID file
rm -f .demo-pids
```

## 🎓 Technical Talking Points

### Pathway Integration

- **Custom GPS Connector**: "We built a custom Python connector using Pathway's `ConnectorSubject` API"
- **Temporal Windows**: "60-second sliding windows with 10-second hops for velocity aggregation"
- **Stream Joins**: "Real-time joins between GPS stream and contract data"
- **Sub-second Latency**: "From GPS update to frontend display in under 500ms"

### AI/LLM Features

- **RAG Pipeline**: "Contract analysis using Retrieval Augmented Generation"
- **OpenAI Integration**: "GPT-4 analyzes contract clauses and suggests alternatives"
- **Embeddings**: "Contract documents embedded and stored for fast semantic search"
- **Confidence Scores**: "AI provides confidence levels for each recommendation"

### Architecture Highlights

- **Microservices**: "Separate streaming backend and frontend for scalability"
- **WebSocket**: "Real-time bidirectional communication"
- **Docker Ready**: "Full deployment configuration included"
- **Zero Downtime**: "Streaming architecture handles restarts gracefully"

## 📈 Metrics to Highlight

During the demo, point out these impressive numbers:

| Metric | Value | Impact |
|--------|-------|--------|
| **GPS Update Frequency** | 1Hz | Real-time tracking |
| **Delay Detection Latency** | <500ms | Instant alerts |
| **Arbitrage Savings** | $1,700 | ROI demonstration |
| **Processing Throughput** | 3 trucks × 1Hz | Scalable to 1000+ |
| **Window Size** | 60s sliding | Accurate velocity trends |
| **AI Response Time** | ~2s | Fast contract analysis |

## 🎯 Target Audience Customization

### For Technical Judges

Focus on:

- Pathway streaming engine implementation
- Temporal window algorithms
- Custom Python connector architecture
- LLM xPack RAG pipeline
- Incremental computation

### For Business Judges

Focus on:

- $1,700 cost savings per incident
- Autonomous decision-making
- Real-time supply chain visibility
- Penalty avoidance ROI
- Customer satisfaction improvement

### For Mixed Audience

Balance between:

- Technical innovation (Pathway, AI)
- Business value (cost savings, efficiency)
- User experience (beautiful UI, simple workflow)
- Scalability (ready for enterprise)

## 🚀 Post-Demo Actions

### Immediate Follow-up

1. Share live URL (if deployed)
2. Provide GitHub repository link
3. Offer technical deep-dive session
4. Send presentation slides
5. Connect on LinkedIn

### Demo Recording

Record the demo and share:

```bash
# Use QuickTime (Mac) or OBS Studio (cross-platform)
# Recommended settings:
# - 1920x1080 resolution
# - 30 fps
# - 8 Mbps bitrate
# - Upload to YouTube/Loom
```

## 📚 Additional Resources

- **README.md** - Complete project documentation
- **backend-pathway/README.md** - Pathway implementation details
- **backend-pathway/docs/** - Technical specifications
- **ARCHITECTURE.md** - System design details

## 🎉 Success Checklist

Before presenting:

- [ ] All services start successfully
- [ ] Browser loads dashboard without errors
- [ ] Trucks visible on map
- [ ] Real-time updates working
- [ ] Arbitrage modal appears at T+10s
- [ ] Confetti animation works
- [ ] Analytics page accessible
- [ ] Logs show no errors
- [ ] Presentation rehearsed
- [ ] Backup plan ready

---

**Ready to demo? Run `./start-demo.sh` and showcase FleetFusion! 🚀**

Good luck! 🎯
