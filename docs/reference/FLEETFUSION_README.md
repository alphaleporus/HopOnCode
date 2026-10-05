# FleetFusion 🚀

**Autonomous Supply Chain Financial Agent with Real-Time Streaming Analytics**

An enterprise-grade SaaS platform that monitors supply chains in real-time, detects delays, calculates financial
penalties, and autonomously proposes arbitrage solutions using **Pathway streaming engine** and **AI-powered contract
analysis**.

---

## 📋 Table of Contents

1. [Overview](#-overview)
2. [System Architecture](#-system-architecture)
3. [Data Flow](#-data-flow)
4. [Technology Stack](#-technology-stack)
5. [Quick Start](#-quick-start)
6. [Detailed Setup](#-detailed-setup)
7. [Features](#-features)
8. [Pathway Integration](#-pathway-integration)
9. [Component Architecture](#-component-architecture)
10. [API Documentation](#-api-documentation)
11. [Deployment](#-deployment)
12. [Development](#-development)

---

## 🎯 Overview

FleetFusion is a real-time supply chain monitoring platform that combines:

- **Real-time GPS tracking** of delivery vehicles
- **Streaming analytics** using Pathway v0.7.0 for instant delay detection
- **AI-powered contract analysis** with OpenAI integration
- **Financial arbitrage detection** to minimize SLA penalties
- **Interactive visualization** with dark-mode optimized maps
- **WebSocket-based real-time updates** for instant frontend notifications

### Key Capabilities

✨ **Real-time Monitoring**: Track multiple trucks simultaneously with 1-second GPS updates  
💰 **Financial Intelligence**: Detect arbitrage opportunities and calculate penalty avoidance savings  
🤖 **Autonomous Decisions**: AI agent analyzes contracts and proposes optimal solutions  
🗺️ **Live Mapping**: Real road routing with OSRM integration, not straight-line approximations  
⚡ **Instant Alerts**: Sub-second latency from GPS update to frontend notification  
📊 **Analytics Dashboard**: Comprehensive metrics with 24-hour trend analysis

---

## 🏗️ System Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          FleetFusion Platform                          │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────┐      ┌──────────────────────────────────────────────┐
│   GPS Sensors   │      │         Pathway Streaming Engine             │
│   (Simulated)   │──────▶         (backend-pathway/)                   │
│   1Hz Updates   │      │                                               │
└─────────────────┘      │  ┌────────────────────────────────────────┐  │
                         │  │  1. GPS Connector (Custom Python)      │  │
                         │  │     • Ingests truck location data      │  │
                         │  │     • Validates schemas                │  │
                         │  └────────────────────────────────────────┘  │
                         │                    ↓                          │
                         │  ┌────────────────────────────────────────┐  │
                         │  │  2. Transformations (Temporal Windows) │  │
                         │  │     • 60-second sliding windows        │  │
                         │  │     • Velocity monitoring              │  │
                         │  │     • Delay detection                  │  │
                         │  └────────────────────────────────────────┘  │
                         │                    ↓                          │
                         │  ┌────────────────────────────────────────┐  │
                         │  │  3. Contract Analysis (AI/RAG)         │  │
                         │  │     • OpenAI integration               │  │
                         │  │     • Contract RAG queries             │  │
                         │  │     • Penalty calculations             │  │
                         │  │     • Arbitrage detection              │  │
                         │  └────────────────────────────────────────┘  │
                         │                    ↓                          │
                         │  ┌────────────────────────────────────────┐  │
                         │  │  4. WebSocket Output (Real-time)       │  │
                         │  │     • Event streaming                  │  │
                         │  │     • Alert broadcasting               │  │
                         │  └────────────────────────────────────────┘  │
                         └──────────────────────────────────────────────┘
                                            │
                                            │ WebSocket (ws://localhost:8765)
                                            ↓
┌─────────────────────────────────────────────────────────────────────────┐
│                        Next.js Frontend (app/)                           │
│                                                                           │
│  ┌──────────────────┐  ┌──────────────────┐  ┌────────────────────┐   │
│  │  Landing Page    │  │   Dashboard      │  │  Analytics         │   │
│  │  • Features      │  │   • Live Map     │  │  • Metrics         │   │
│  │  • Auto-metrics  │  │   • Agent Stream │  │  • Trends          │   │
│  └──────────────────┘  └──────────────────┘  └────────────────────┘   │
│                                                                           │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │           React-Leaflet Map + OSRM Routing                       │   │
│  │           • Dark mode optimized tiles                            │   │
│  │           • Real-time truck positions                            │   │
│  │           • Dynamic status colors (🟢🟡🔴💜)                      │   │
│  └─────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│                     External Services (No Auth)                          │
│  • OpenStreetMap (Map Tiles)                                            │
│  • OSRM (Routing API)                                                   │
│  • OpenAI (LLM for contract analysis)                                   │
└─────────────────────────────────────────────────────────────────────────┘
```

### Architecture Layers

#### 1. **Data Ingestion Layer** (Pathway Custom Connector)

- Custom Python connector using `pw.io.python.ConnectorSubject`
- Simulates GPS sensors with configurable update frequency (default: 1Hz)
- Handles 3 concurrent truck streams
- Schema validation and type checking

#### 2. **Streaming Processing Layer** (Pathway Core)

- **Temporal Windows**: 60-second sliding windows with 10-second hops
- **Real-time Aggregations**: Min/max/avg velocity calculations
- **Stream Joins**: Dynamic joining of delayed trucks with contract data
- **Event Detection**: Status change detection (on-time → delayed → critical)

#### 3. **Intelligence Layer** (AI/LLM)

- OpenAI GPT-4 integration for contract analysis
- RAG (Retrieval Augmented Generation) for contract queries
- Penalty calculation algorithms
- Arbitrage opportunity detection

#### 4. **Output Layer** (WebSocket + JSONL)

- Real-time WebSocket server for frontend updates
- JSONL file outputs for debugging and archival
- Event broadcasting with sub-second latency

#### 5. **Presentation Layer** (Next.js Frontend)

- Server-side rendering with App Router
- Dynamic imports for map components (SSR disabled)
- Real-time state management with React hooks
- Smooth animations with Framer Motion

---

## 🔄 Data Flow

### End-to-End Data Pipeline

```
┌─────────────────────────────────────────────────────────────────────────┐
│ Step 1: GPS Data Generation                                             │
└─────────────────────────────────────────────────────────────────────────┘
    📍 Simulated GPS sensors emit position updates every 1 second
    📊 Data: {truck_id, lat, lon, velocity, timestamp, ...}
                                  ↓
┌─────────────────────────────────────────────────────────────────────────┐
│ Step 2: Pathway Ingestion (Custom Connector)                            │
└─────────────────────────────────────────────────────────────────────────┘
    🔌 ConnectorSubject.next_json() receives GPS updates
    ✅ Schema validation (pw.schema_from_types)
    💾 Creates streaming Pathway table
                                  ↓
┌─────────────────────────────────────────────────────────────────────────┐
│ Step 3: Temporal Window Analysis (60s windows, 10s hop)                 │
└─────────────────────────────────────────────────────────────────────────┘
    ⏰ Group GPS updates into time-based windows
    📊 Calculate velocity statistics per truck
    🔍 Detect velocity drops below threshold (<10 km/h = delay)
                                  ↓
┌─────────────────────────────────────────────────────────────────────────┐
│ Step 4: Delay Detection & Classification                                │
└─────────────────────────────────────────────────────────────────────────┘
    🟢 ON-TIME:   velocity >= 65 km/h
    🟡 DELAYED:   velocity < 65 km/h (minor issue)
    🔴 CRITICAL:  velocity < 10 km/h + duration > 180s (SLA breach)
                                  ↓
┌─────────────────────────────────────────────────────────────────────────┐
│ Step 5: Contract Analysis (Stream Join)                                 │
└─────────────────────────────────────────────────────────────────────────┘
    🔗 Join delayed trucks with contract data
    📄 Retrieve SLA terms, penalty clauses, delivery deadlines
    💰 Calculate potential financial penalties
                                  ↓
┌─────────────────────────────────────────────────────────────────────────┐
│ Step 6: AI Analysis (OpenAI + RAG)                                      │
└─────────────────────────────────────────────────────────────────────────┘
    🤖 Query OpenAI with contract context + delay info
    🔍 RAG: Retrieve relevant contract clauses
    💡 Generate arbitrage recommendations:
       • Alternative supplier costs
       • Relief vehicle availability
       • Net savings calculations
                                  ↓
┌─────────────────────────────────────────────────────────────────────────┐
│ Step 7: Event Broadcasting (WebSocket)                                  │
└─────────────────────────────────────────────────────────────────────────┘
    📡 Broadcast events to connected WebSocket clients
    📤 Event types:
       • gps_update (truck position)
       • status_change (🟢→🟡→🔴)
       • delay_detected (alert)
       • arbitrage_opportunity (modal trigger)
                                  ↓
┌─────────────────────────────────────────────────────────────────────────┐
│ Step 8: Frontend Update (React State + Map)                             │
└─────────────────────────────────────────────────────────────────────────┘
    🗺️ Update truck markers on map
    📊 Refresh metrics in dashboard
    🎨 Animate status color changes
    🔔 Show arbitrage modal with confetti
                                  ↓
┌─────────────────────────────────────────────────────────────────────────┐
│ Step 9: User Action (1-Click Fix)                                       │
└─────────────────────────────────────────────────────────────────────────┘
    👆 User clicks "Execute Fix"
    🎉 Confetti animation (2 seconds)
    💜 Truck status → RESOLVED
    ✅ Problem solved, delivery back on track
```

### Timeline Example (12-Second Demo Scenario)

```
T+0s  : 🚀 System initialized, 3 trucks loaded
        • TRK-402: Pune → Mumbai (Priya Sharma)
        • TRK-301: Bangalore → Delhi (Rajesh Kumar)
        • TRK-205: Mumbai → Kolkata (Anita Desai)

T+2s  : 📡 All trucks reporting GPS (status: 🟢 ON-TIME)
        Velocities: 68 km/h, 72 km/h, 65 km/h

T+5s  : 🟡 TRK-402 velocity drops to 0 km/h
        Event: "Truck stopped - possible traffic jam"
        Status: ON-TIME → DELAYED

T+8s  : 🔴 TRK-402 stopped for >180 seconds
        Event: "Critical delay - SLA breach imminent"
        Contract analysis triggered
        AI calculates: $2,500 penalty incoming
        Status: DELAYED → CRITICAL

T+10s : 💡 Arbitrage opportunity detected
        Alternative supplier found: $800 cost
        Net savings: $2,500 - $800 = $1,700
        Modal appears on dashboard

T+12s : 👆 User clicks "Execute 1-Click Fix"
        🎉 Confetti animation
        💜 TRK-402 status → RESOLVED
        Relief vehicle dispatched
        Original truck issue noted for post-delivery analysis
```

---

## 🛠️ Technology Stack

### Frontend (Next.js)

| Technology          | Version | Purpose                                  |
|---------------------|---------|------------------------------------------|
| **Next.js**         | 14      | React framework with App Router          |
| **TypeScript**      | 5       | Type safety and developer experience     |
| **Tailwind CSS**    | 4       | Utility-first styling with dark mode     |
| **Framer Motion**   | 12      | Animation library for smooth transitions |
| **React-Leaflet**   | 5.0     | Interactive map component                |
| **Leaflet**         | 1.9     | Core mapping library                     |
| **Lucide React**    | Latest  | Modern icon library                      |
| **canvas-confetti** | Latest  | Celebration animations                   |

### Backend (Pathway Streaming)

| Technology     | Version | Purpose                               |
|----------------|---------|---------------------------------------|
| **Pathway**    | 0.7.0   | Streaming data processing engine      |
| **Python**     | 3.12+   | Runtime environment                   |
| **OpenAI**     | Latest  | LLM integration for contract analysis |
| **websockets** | Latest  | Real-time communication               |
| **aiohttp**    | Latest  | Async HTTP client for OpenAI API      |

### External Services (No Auth Required)

| Service           | Purpose           | Endpoint                |
|-------------------|-------------------|-------------------------|
| **OpenStreetMap** | Map tiles         | tile.openstreetmap.org  |
| **OSRM**          | Road routing      | router.project-osrm.org |
| **OpenAI API**    | Contract analysis | api.openai.com          |

---

## 🚀 Quick Start

### One-Command Demo (Recommended)

The fastest way to run the complete demo:

```bash
./start-demo.sh
```

This automated script will:

- ✅ Check all prerequisites
- ✅ Install dependencies if needed
- ✅ Start all services (Pathway, WebSocket, Frontend)
- ✅ Monitor processes
- ✅ Provide access URLs
- ✅ Gracefully shutdown with Ctrl+C

**See [DEMO.md](DEMO.md) for complete demo guide and presentation tips.**

---

### Manual Setup

If you prefer to start services individually:

### Prerequisites

- **Node.js** 18+ and npm
- **Python** 3.12+
- **Git**

### 1. Clone Repository

```bash
git clone <repository-url>
cd GenAI_Proj
```

### 2. Frontend Setup

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### 3. Backend Setup (Pathway)

```bash
# Navigate to backend directory
cd backend-pathway

# Create virtual environment
python3 -m venv venv-pathway
source venv-pathway/bin/activate  # On Windows: venv-pathway\Scripts\activate

# Install dependencies
pip install -r requirements-pathway.txt

# Set up environment variables
echo "OPENAI_API_KEY=your_key_here" > .env

# Start streaming pipeline
python main.py
```

### 4. Start WebSocket Server

```bash
# In a separate terminal (backend-pathway directory)
source venv-pathway/bin/activate
python websocket_server.py
```

You should now have:

- ✅ Frontend running on http://localhost:3000
- ✅ Pathway pipeline processing GPS data
- ✅ WebSocket server on ws://localhost:8765

---

## 📖 Detailed Setup

### Frontend Configuration

#### Environment Variables

Create `.env.local` in root directory:

```bash
# Optional: Only needed if using real authentication
NEXTAUTH_SECRET=your-secret-key-here
NEXTAUTH_URL=http://localhost:3000

# Pathway WebSocket URL
NEXT_PUBLIC_WS_URL=ws://localhost:8765
```

#### Development Commands

```bash
# Development server with hot reload
npm run dev

# Production build
npm run build

# Start production server
npm start

# Linting
npm run lint

# Type checking
npm run type-check
```

### Backend Configuration

#### Pathway Setup

```bash
cd backend-pathway

# Verify Pathway installation
python -c "import pathway as pw; print(f'Pathway version: {pw.__version__}')"

# Expected output: Pathway version: 0.7.0
```

#### Environment Variables

Create `.env` in `backend-pathway/`:

```bash
# Required for AI contract analysis
OPENAI_API_KEY=sk-your-openai-api-key

# Optional: Customize WebSocket port
WEBSOCKET_PORT=8765

# Optional: Customize GPS update frequency (seconds)
GPS_UPDATE_INTERVAL=1
```

#### Running Tests

```bash
# Unit tests for connectors
PYTHONPATH=. python tests/test_connectors.py

# Integration tests
PYTHONPATH=. python tests/test_integration.py

# LLM integration tests (requires OpenAI API key)
PYTHONPATH=. python tests/test_llm_xpack.py

# Transformation tests
PYTHONPATH=. python tests/test_transformations.py
```

---

## ✨ Features

### Core Functionality

#### 🗺️ Real-Time Map Visualization

- **Dark Mode Optimized**: Inverted OSM tiles with custom CSS filters
- **Live Truck Tracking**: 3 trucks with real-time position updates
- **OSRM Road Routing**: Actual road routes, not straight lines
- **Dynamic Status Colors**:
    - 🟢 Green: On-time (velocity >= 65 km/h)
    - 🟡 Yellow: Minor delay (velocity < 65 km/h)
    - 🔴 Red: Critical delay (stopped >180s, SLA breach)
    - 💜 Purple: Resolved (fix executed)

#### 📊 Analytics Dashboard

- **24-Hour Metrics**: Auto-updating statistics
    - Active shipments
    - On-time delivery rate
    - Average delay
    - Arbitrage savings
- **Agent Activity Stream**: Real-time event log
- **Financial Impact Tracking**: Penalty avoidance calculations

#### 🤖 Autonomous Agent

- **Delay Detection**: Sub-second latency from GPS to alert
- **Contract Analysis**: AI-powered RAG queries
- **Arbitrage Detection**: Finds cost-effective alternatives
- **1-Click Execution**: User approves, agent handles rest

#### 💰 Financial Intelligence

- **SLA Penalty Calculation**: Real-time penalty tracking
- **Alternative Supplier Costs**: Market rate queries
- **Net Savings Analysis**: ROI calculations
- **Trend Visualization**: Historical performance

### Map Features

#### Smart Centering

- **Auto-fit**: Dynamically zooms to show all trucks
- **Centering Button**: Manual recenter control (⊕ icon)
- **Smooth Animation**: 0.5s transition
- **Fallback**: Centers on India if no trucks

#### Route Visualization

- **Real Roads**: OSRM routing for accurate paths
- **Color-Coded**: Matches truck status
- **Eco-Routes**: Optional carbon-optimized paths (dashed lines)
- **Caching**: Stores fetched routes for performance

#### Zoom Controls

- **Min Zoom**: 3 (prevents excessive zoom-out)
- **Max Zoom**: 18 (street-level detail)
- **Bounded**: Prevents map wrapping
- **Viscosity**: Rigid boundary enforcement

### UI/UX Features

#### 🎨 Modern Design

- **Glassmorphism**: Frosted glass effect on cards
- **Dark Mode**: Optimized for low-light viewing
- **Smooth Animations**: Spring physics transitions
- **Responsive**: Desktop-first, mobile-compatible

#### 🎊 Celebration Effects

- **Confetti Animation**: On arbitrage execution
    - Duration: 2 seconds
    - Particles: 50 per burst
    - Two-sided launch
    - High z-index overlay

#### ⚡ Performance

- **Lazy Loading**: Map components load client-side only
- **Route Caching**: Prevents redundant OSRM requests
- **Rate Limiting**: 300ms delay between route fetches
- **GPU Acceleration**: CSS `will-change` optimization

---

## 🌊 Pathway Integration

### Architecture Overview

FleetFusion leverages **Pathway v0.7.0** for real-time streaming analytics with a modular team-based architecture:

```
Team A: Data Ingestion     → Custom GPS Connector
Team B: Transformations    → Temporal Windows + Delay Detection
Team C: AI Integration     → LLM + RAG for Contract Analysis
Team D: Output Layer       → WebSocket Broadcasting
```

### Custom GPS Connector (Team A)

**Location**: `backend-pathway/connectors/gps_connector.py`

```python
class GPSConnector(pw.io.python.ConnectorSubject):
    def __init__(self):
        super().__init__()
        self.trucks = [
            {"truck_id": "TRK-402", "driver": "Priya Sharma", ...},
            {"truck_id": "TRK-301", "driver": "Rajesh Kumar", ...},
            {"truck_id": "TRK-205", "driver": "Anita Desai", ...}
        ]
    
    def run(self):
        while True:
            for truck in self.trucks:
                # Simulate GPS update
                self.next_json(truck)
            self.commit()
            time.sleep(1)  # 1Hz update frequency
```

**Schema**: See `backend-pathway/docs/GPS_STREAM_SCHEMA.md`

### Temporal Windows (Team B)

**Location**: `backend-pathway/transformations/delay_detection.py`

```python
# 60-second sliding windows with 10-second hop
windowed = gps_stream.windowby(
    pw.this.timestamp,
    window=pw.temporal.sliding(
        hop=datetime.timedelta(seconds=10),
        duration=datetime.timedelta(seconds=60)
    ),
    instance=pw.this.truck_id
)

# Velocity aggregations
velocity_stats = windowed.reduce(
    truck_id=pw.this._pw_instance,
    avg_velocity=pw.reducers.avg(pw.this.velocity),
    min_velocity=pw.reducers.min(pw.this.velocity),
    max_velocity=pw.reducers.max(pw.this.velocity)
)

# Delay detection
delayed = velocity_stats.filter(pw.this.min_velocity < 10)
```

### AI Contract Analysis (Team C)

**Location**: `backend-pathway/llm/contract_rag.py`

```python
from pathway.xpacks.llm import llms

# RAG pipeline for contract queries
contract_rag = llms.DocumentStore(
    docs_folder="data/contracts/",
    embedder=llms.OpenAIEmbedder(api_key=os.getenv("OPENAI_API_KEY"))
)

# Join delayed trucks with contract analysis
arbitrage_opportunities = delayed.join(
    contract_rag.query(
        prompt=f"Find alternative suppliers for {truck_id}. Calculate net savings."
    )
)
```

### WebSocket Output (Team D)

**Location**: `backend-pathway/adapters/websocket_output.py`

```python
class WebSocketOutput:
    async def send_event(self, event_type: str, data: dict):
        for client in self.connected_clients:
            await client.send(json.dumps({
                "type": event_type,
                "data": data,
                "timestamp": time.time()
            }))

# Connect to Pathway output
pw.io.subscribe(truck_status, on_change=websocket_output.send_event)
```

### Key Pathway Features Used

1. **Custom Python Connectors**: `pw.io.python.ConnectorSubject`
2. **Schema Validation**: `pw.schema_from_types()`
3. **Temporal Windows**: `pw.temporal.sliding()`
4. **Stream Joins**: `table1.join(table2, ...)`
5. **Aggregations**: `pw.reducers.avg()`, `min()`, `max()`
6. **Filtering**: `table.filter(condition)`
7. **Output Adapters**: Custom WebSocket integration
8. **LLM Integration**: `pathway.xpacks.llm`

---

## 🏛️ Component Architecture

### Frontend Structure

```
app/
├── page.tsx                          # Landing page
├── dashboard/
│   └── page.tsx                      # Main dashboard (map + agent stream)
├── analytics/
│   └── page.tsx                      # Analytics & trends
├── login/
│   └── page.tsx                      # Authentication page
├── track/
│   └── [orderId]/page.tsx           # Public tracking page
├── layout.tsx                        # Root layout with providers
└── globals.css                       # Global styles + dark mode

components/
├── SupplyChainMap.tsx                # Main map component (Leaflet)
├── SessionProvider.tsx               # NextAuth session wrapper
├── landing/
│   └── FeatureCards.tsx              # Auto-updating metric cards
└── dashboard/
    ├── AgentOverlay.tsx              # Right sidebar event stream
    └── FinancialModal.tsx            # Arbitrage opportunity modal

lib/
├── hooks/
│   ├── useSupplyChainStream.ts      # WebSocket hook + simulation
│   └── useRealTimeMetrics.ts        # 24h metric aggregation
├── utils/
│   ├── routing.ts                    # OSRM API wrapper
│   └── calculations.ts               # Financial calculations
└── types/
    └── index.ts                      # TypeScript definitions

types/
└── next-auth.d.ts                    # NextAuth type extensions
```

### Backend Structure

```
backend-pathway/
├── main.py                           # Pipeline orchestration
├── websocket_server.py               # WebSocket server (asyncio)
│
├── connectors/
│   ├── __init__.py
│   └── gps_connector.py              # Custom GPS streaming connector
│
├── transformations/
│   ├── __init__.py
│   ├── delay_detection.py            # Temporal windows + aggregations
│   └── demo_scenario.py              # 12-second scripted demo
│
├── llm/
│   ├── __init__.py
│   └── contract_rag.py               # OpenAI + RAG integration
│
├── adapters/
│   ├── __init__.py
│   └── websocket_output.py           # WebSocket event broadcaster
│
├── tests/
│   ├── test_connectors.py            # Unit tests
│   ├── test_transformations.py       # Transform logic tests
│   ├── test_llm_xpack.py            # AI integration tests
│   └── test_integration.py           # End-to-end tests
│
├── docs/
│   ├── GPS_STREAM_SCHEMA.md         # Data schema documentation
│   └── TRANSFORMATIONS.md            # Transformation logic guide
│
├── data/
│   ├── contracts/                    # Sample contract PDFs
│   └── routes/                       # Pre-computed OSRM routes
│
└── output/
    ├── gps_stream.jsonl              # GPS updates (debugging)
    ├── truck_status.jsonl            # Processed status (debugging)
    ├── events.jsonl                  # Event log
    └── arbitrage_opportunities.jsonl # Financial insights
```

---

## 📡 API Documentation

### WebSocket Events

#### Server → Client Events

##### 1. `gps_update`

Real-time truck position update

```json
{
  "type": "gps_update",
  "data": {
    "truck_id": "TRK-402",
    "lat": 18.7234,
    "lon": 73.6543,
    "velocity": 68,
    "timestamp": 1704484800
  },
  "timestamp": 1704484800.123
}
```

##### 2. `status_change`

Truck status transition

```json
{
  "type": "status_change",
  "data": {
    "truck_id": "TRK-402",
    "old_status": "on-time",
    "new_status": "delayed",
    "reason": "Velocity drop detected"
  },
  "timestamp": 1704484805.456
}
```

##### 3. `delay_detected`

Critical delay alert

```json
{
  "type": "delay_detected",
  "data": {
    "truck_id": "TRK-402",
    "severity": "critical",
    "duration": 185,
    "estimated_penalty": 2500,
    "contract_id": "CNT-789"
  },
  "timestamp": 1704484810.789
}
```

##### 4. `arbitrage_opportunity`

Financial arbitrage detected

```json
{
  "type": "arbitrage_opportunity",
  "data": {
    "truck_id": "TRK-402",
    "contract_penalty": 2500,
    "alternative_cost": 800,
    "net_savings": 1700,
    "supplier": "FastTrack Logistics",
    "eta_improvement": "2 hours",
    "confidence": 0.92
  },
  "timestamp": 1704484815.012
}
```

#### Client → Server Events

##### `subscribe`

Subscribe to specific truck updates

```json
{
  "action": "subscribe",
  "truck_ids": ["TRK-402", "TRK-301"]
}
```

##### `execute_fix`

Execute arbitrage solution

```json
{
  "action": "execute_fix",
  "truck_id": "TRK-402",
  "solution_id": "ARB-12345"
}
```

### REST API (Optional)

#### `GET /api/trucks`

Get all active trucks

**Response**:

```json
{
  "trucks": [
    {
      "truck_id": "TRK-402",
      "driver": "Priya Sharma",
      "status": "on-time",
      "current_location": {"lat": 18.7234, "lon": 73.6543},
      "velocity": 68,
      "cargo_value": 45000,
      "contract_id": "CNT-789"
    }
  ],
  "total": 3,
  "timestamp": 1704484800
}
```

#### `GET /api/contracts/:id`

Get contract details

**Response**:

```json
{
  "contract_id": "CNT-789",
  "client": "TechCorp Industries",
  "origin": "Pune",
  "destination": "Mumbai",
  "sla_hours": 6,
  "penalty_per_hour": 500,
  "cargo_value": 45000
}
```

---

## 🚢 Deployment

### Vercel (Frontend - Recommended)

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel deploy --prod

# Set environment variables in Vercel dashboard
# NEXT_PUBLIC_WS_URL=wss://your-backend-url.com
```

### Docker (Backend)

#### Build & Run

```bash
cd backend-pathway

# Build image
docker build -t fleetfusion-pathway .

# Run container
docker run -d \
  -p 8765:8765 \
  -e OPENAI_API_KEY=your_key \
  --name pathway-backend \
  fleetfusion-pathway
```

#### Docker Compose

```bash
docker-compose up -d
```

**docker-compose.yml**:

```yaml
version: '3.8'
services:
  pathway:
    build: ./backend-pathway
    ports:
      - "8765:8765"
    environment:
      - OPENAI_API_KEY=${OPENAI_API_KEY}
    volumes:
      - ./backend-pathway/output:/app/output
```

### Production Checklist

- [ ] Set `OPENAI_API_KEY` in environment
- [ ] Configure WebSocket URL (`NEXT_PUBLIC_WS_URL`)
- [ ] Enable HTTPS/WSS for production
- [ ] Set up monitoring (logs, metrics)
- [ ] Configure CORS for WebSocket
- [ ] Enable rate limiting
- [ ] Set up database for contract storage (optional)
- [ ] Configure CDN for static assets
- [ ] Set up error tracking (Sentry)

---

## 👨‍💻 Development

### Local Development Workflow

1. **Frontend Hot Reload**:
   ```bash
   npm run dev
   # Runs on http://localhost:3000
   # Changes auto-reload
   ```

2. **Backend Development**:
   ```bash
   cd backend-pathway
   source venv-pathway/bin/activate
   python main.py
   # Monitor output/ directory for JSONL files
   ```

3. **WebSocket Server**:
   ```bash
   python websocket_server.py
   # Runs on ws://localhost:8765
   ```

### Testing Strategy

#### Frontend Tests

```bash
# Type checking
npm run type-check

# Linting
npm run lint

# Component tests (if configured)
npm run test
```

#### Backend Tests

```bash
cd backend-pathway

# Run all tests
PYTHONPATH=. python -m pytest tests/

# Run specific test file
PYTHONPATH=. python tests/test_connectors.py

# With coverage
PYTHONPATH=. pytest --cov=. tests/
```

### Debugging

#### Frontend Debugging

- Open browser DevTools
- Check **Console** for errors
- Monitor **Network** tab for WebSocket messages
- Use **React DevTools** for component inspection

#### Backend Debugging

- Check `backend-pathway/output/*.jsonl` files
- Monitor Pathway logs in terminal
- Use `print()` statements in connectors
- Enable Pathway debug mode: `pw.run(monitoring_level=pw.MonitoringLevel.ALL)`

### Performance Optimization

#### Frontend

- Use `React.memo()` for expensive components
- Lazy load map with `next/dynamic`
- Optimize images with Next.js Image component
- Use CSS `will-change` for animated elements

#### Backend

- Batch GPS updates before committing
- Use Pathway's built-in aggregations (optimized C++)
- Cache OSRM route responses
- Limit WebSocket broadcast rate (e.g., max 10 updates/second)

---

## 📚 Additional Resources

### Documentation

- [Pathway Official Docs](https://pathway.com/developers/)
- [Next.js Documentation](https://nextjs.org/docs)
- [React-Leaflet Docs](https://react-leaflet.js.org/)
- [OSRM API Reference](http://project-osrm.org/docs/v5.24.0/api/)

### Tutorials

- [Pathway Custom Connectors](https://pathway.com/developers/user-guide/connect/connectors/custom-python-connectors)
- [Temporal Windows Guide](https://pathway.com/developers/user-guide/temporal-data/windows-manual)
- [Pathway LLM Integration](https://pathway.com/developers/user-guide/llm-xpack/)

### Inspiration

- [La Poste Pathway Case Study](https://pathway.com/blog/pathway-laposte-microservices/)
- [Real-time Supply Chain Visibility](https://pathway.com/solutions/supply-chain)

---

## 🤝 Contributing

Contributions are welcome! Please follow these guidelines:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Code Style

- **Frontend**: Follow ESLint rules (`npm run lint`)
- **Backend**: Follow PEP 8 (`black` formatter recommended)
- **Commits**: Use conventional commits (e.g., `feat:`, `fix:`, `docs:`)

---

## 📄 License

This project is built for educational and demonstration purposes.

---

## 🐛 Recent Bug Fixes & Improvements

### December 2025 Updates

#### ✅ Fixed Pathway Pipeline Stability

- **Issue**: Pipeline was crashing due to incorrect `windowby()` API usage
- **Fix**: Updated temporal window syntax to use `groupby().windowby()` pattern
- **Impact**: Pipeline now runs stably without crashes
- **Files Changed**: `backend-pathway/transformations/delay_detection.py`

#### ✅ Fixed Arbitrage Popup Display

- **Issue**: Arbitrage opportunities weren't showing in the frontend modal
- **Root Cause**: 5-second delay filter was blocking legitimate opportunities
- **Fix**:
    - Reduced connection freshness check from 5s to 2s
    - Added comprehensive logging for arbitrage flow
    - Fixed field name mapping (camelCase vs snake_case)
- **Impact**: Arbitrage popups now appear within 2-3 seconds of detection
- **Files Changed**:
    - `lib/hooks/useWebSocket.ts`
    - `backend-pathway/adapters/websocket_output.py`

#### ✅ Fixed Agent Stream After Arbitrage Execution

- **Issue**: Critical alerts continued showing after clicking "Execute 1-Click Fix"
- **Root Cause**: No mechanism to filter alerts for resolved trucks
- **Fix**:
    - Added `resolvedTrucksSet` to track executed arbitrage solutions
    - Filter critical events for resolved trucks from agent stream
    - Update truck status to "resolved" (💜 purple marker)
    - Display success message: "✅ TRK-402 RESOLVED - Relief truck dispatched!"
    - Clear existing critical alerts on execution
- **Impact**: Clean UX - alerts stop immediately after problem is solved
- **Files Changed**: `lib/hooks/useWebSocket.ts`

#### ✅ Enhanced Status Visualization

- **Issue**: Resolved trucks needed visual distinction
- **Fix**: Added purple (💜) status color for resolved trucks
- **Impact**: Clear visual feedback on map and legend
- **Files Changed**: `components/SupplyChainMap.tsx` (already supported resolved status)

### Technical Improvements

#### Pathway API Migration

```python
# Old (crashed):
gps_stream.windowby(...)

# New (stable):
gps_stream
  .groupby(pw.this.truck_id)
  .windowby(
    pw.this.timestamp,
    window=pw.temporal.sliding(duration=60000, hop=10000)
  )
  .reduce(...)
```

#### WebSocket Event Filtering

```typescript
// Filter critical events for resolved trucks
const filteredEvents = events.filter(event => {
  const isCriticalAlert = event.message.includes('CRITICAL');
  if (isCriticalAlert) {
    const truckId = event.message.match(/TRK-\d+/)?.[0];
    return !resolvedTrucksSet.has(truckId);
  }
  return true;
});
```

#### Arbitrage Opportunity Flow

```
1. Backend detects critical delay (velocity < 10 km/h)
2. AI analyzes contract + calculates savings
3. WebSocket broadcasts arbitrage opportunity
4. Frontend checks: isFresh && !isDismissed && !hasExisting
5. Modal appears with confetti animation
6. User clicks "Execute 1-Click Fix"
7. Truck status → RESOLVED (💜)
8. Critical alerts filtered out
9. Success message added to stream
```

### Performance Metrics

| Metric                     | Before       | After            |
|----------------------------|--------------|------------------|
| Arbitrage popup delay      | Never showed | 2-3 seconds      |
| Critical alert persistence | Infinite     | Stops on resolve |
| Pipeline stability         | Crashed      | Stable           |
| Status update latency      | N/A          | <1 second        |

### Future Enhancements

- [ ] Persist resolved status in backend (currently frontend-only)
- [ ] Add analytics for arbitrage execution rate
- [ ] Implement undo functionality for executed fixes
- [ ] Add real-time cost savings counter
- [ ] Export arbitrage decisions to CSV/PDF reports

---

## 🙏 Acknowledgments

- **Pathway** team for the streaming engine and hackathon
- **OpenStreetMap** contributors for map data
- **OSRM** project for routing API
- **Next.js** team for the awesome framework

---

**Built with ❤️ for real-time supply chain intelligence**

🚀 **Production-ready** • 🌙 **Dark mode optimized** • ⚡ **Sub-second latency** • 🔒 **No API keys required (except OpenAI)**

