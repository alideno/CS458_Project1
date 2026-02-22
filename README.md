# CS458_Project1

# ARES: Autonomous Self-Healing Authentication & Adaptive Security
[cite_start]**Course:** CS458 - Software Verification and Validation (Spring 2025-2026) [cite: 1, 2, 3]
[cite_start]**Project:** #1 - Autonomous Self-Healing Authentication & Adaptive Security [cite: 4, 6]

---

## 📌 Project Overview
[cite_start]The **ARES** system is an "Intelligent Auth System" designed to survive environmental failures and UI changes[cite: 5, 8]. It consists of:
1.  [cite_start]**Web Login Portal:** Supports Email/Phone + Password and Social Auth (Google/Facebook)[cite: 11].
2.  [cite_start]**Adaptive Security Layer:** A context-aware interceptor that triggers LLM-based fraud analysis upon high-risk detection (e.g., 10th failed attempt or new IP)[cite: 12].
3.  [cite_start]**Self-Healing Selenium Framework:** An automated testing suite that uses LLMs (GPT-4) to repair broken selectors at runtime by analyzing the Page Source (DOM)[cite: 9, 17, 22].

---

## 🛠️ Prerequisites & Setup

### 1. Environment Requirements
* **Node.js** (v18+) & **npm**
* [cite_start]**Firebase Project:** For user management and authentication[cite: 65, 66].
* [cite_start]**LLM API Key:** OpenAI (GPT-4) for the repair mechanism[cite: 22].
* [cite_start]**Web Drivers:** ChromeDriver (matching your Chrome version)[cite: 17].

### 2. Installation
Clone the repository and install the core dependencies:
```bash
npm install express ejs firebase-admin passport passport-google-oauth20 passport-facebook express-session selenium-webdriver