<div align="center">
  <img src="https://raw.githubusercontent.com/kevinb84/NeonDrift/main/public/vite.svg" alt="Neon Drift Logo" width="120" />
</div>

<h1 align="center">🏎️ Neon Drift</h1>

<div align="center">
  <strong>The Ultimate On-Chain Cyberpunk Racing Ecosystem.</strong><br>
  Built for the <a href="https://bags.fm/hackathon">Bags.fm Hackathon</a>
</div>

<br />

<div align="center">
  <img src="https://img.shields.io/badge/Blockchain-Solana-14F195?style=flat-square&logo=solana&logoColor=white" />
  <img src="https://img.shields.io/badge/API-Bags.fm-8B5CF6?style=flat-square" />
  <img src="https://img.shields.io/badge/Backend-InsForge-000000?style=flat-square&logo=postgresql&logoColor=white" />
  <img src="https://img.shields.io/badge/Frontend-React_Three_Fiber-61DAFB?style=flat-square&logo=react&logoColor=black" />
  <a href="https://github.com/kevinb84/NeonDrift"><img src="https://img.shields.io/github/stars/kevinb84/NeonDrift?style=flat-square" /></a>
</div>

<br />

## 🏁 What is Neon Drift?
Neon Drift is a full-stack, browser-based 3D racing game interwoven directly with the Solana blockchain. It transforms the concept of decentralized gaming by treating the **$NDRIFT** token not just as an asset, but as the core fuel for the ecosystem. 

Players can stake their tokens via Bags.fm bonding curves, race against real-time global opponents using WebSockets, review Ghost replays of top performers, and earn outsized dynamic rewards governed by the Oracle server.

---

## 🚀 The Bags.fm Integration (Hackathon Core)
This project deeply integrates with the Bags.fm API to handle all ecosystem tokenomics natively within our `Dashboard`:

1. **Token Deployer Engine (`CreateToken.tsx`)**
   Users can architect and formally launch their ecosystem tokens to the Solana Mainnet directly through the dashboard. This securely signs via Phantom and pings the Bags API to construct the bonding curve. 
2. **In-game DEX (`SwapPanel.tsx`)**
   Powered by the Bags API `quote` and `/trade` endpoints, players can visually trade `$NDRIFT` alongside any Solana token straight from the frontend—bypassing the need to use an external exchange.
3. **Token Discovery (`TokenExplorer.tsx`)**
   We utilize the Bags `/token-launch/feed` to build a live global trending board. This lets players search and buy into other gaming tokens securely without leaving the ecosystem.

---

## 🏗️ Architecture Stack
* **Frontend:** Vite, React, TailwindCSS, `framer-motion` for fluid dashboard animations.
* **Game Engine:** `three.js` & React Three Fiber (@react-three/drei, @react-three/postprocessing). Includes dynamic lighting, particle systems, collision logic, and generative WebAudio engine synthesis.
* **Smart Contracts (Solana):** Anchor Framework representing the on-chain match resolving pools and escrow. 
* **Database & Auth:** Authenticated wallets are synced to an `InsForge` PostgreSQL Backend which records Match History, Top Leaderboards, and stores Ghost Replay files using InsForge Object Storage.
* **Realtime Server:** Using Node.js WebSockets and InsForge Pub/Sub for sub-100ms multiplayer coordinate synchronization.

---

## 🕹️ Game Features
* **Ranked Matchmaking:** Put your $NDRIFT on the line. 
* **Dynamic Blockchain Difficulty:** Engine power and AI opponent speed scale according to the value staked in the on-chain match pool.
* **Procedural WebAudio Synthesis:** Because downloading car sounds felt cheap, we built a raw Web Audio Oscillator algorithm to synthetically generate aggressive engine pitches that respond dynamically to your in-game velocity.
* **Ghost Replays:** Best laps are algorithmically compressed and uploaded to the InsForge database, allowing beginners to visually train alongside the fastest racers on the global leaderboard.

---

## 💻 Running it Locally
1. **Clone the repository**
   ```bash
   git clone https://github.com/kevinb84/NeonDrift.git
   cd NeonDrift
   ```
2. **Install Dependencies**
   ```bash
   npm install
   ```
3. **Configure Environment**
   *Create a `.env` file referencing `.env.example` and supply your `VITE_BAGS_API_KEY`, your Alchemy `VITE_SOLANA_RPC_URL`, and your InsForge database variables.*
4. **Boot the Game**
   ```bash
   npm run dev
   ```

---
<div align="center">
   <i>Powered by Solana. Designed by kevinb84. Prepared for the Bags.fm Hackathon.</i>
</div>
