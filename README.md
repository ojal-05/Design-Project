# AR/VR-Based Immersive Healthcare Training and Emergency Response Simulator

An interactive healthcare training and emergency response simulation platform designed to help medical trainees develop clinical decision-making, emergency response, and patient-care skills through immersive virtual environments.

## Project Overview

The **Immersive Healthcare Training and Emergency Response Simulator** is a technology-based training platform that provides simulated hospital environments and emergency scenarios for healthcare learning.

The system allows trainees to interact with virtual patients, explore emergency situations, perform simulated medical procedures, and evaluate their performance through structured assessments.

The platform aims to provide a safe and controlled environment where learners can practise emergency response skills without putting real patients at risk.

## Objectives

- Develop an interactive environment for healthcare and emergency response training.
- Simulate realistic patient conditions and emergency situations.
- Improve clinical decision-making and response time.
- Provide performance evaluation and feedback to trainees.
- Track training sessions, actions, mistakes, and learning progress.
- Explore the integration of Augmented Reality (AR) and Virtual Reality (VR) technologies into medical education.

## Key Features

### 1. Interactive Healthcare Environment
- Virtual hospital and emergency room environments.
- Interactive medical equipment and healthcare assets.
- 3D humanoid characters and responder avatars.
- Immersive simulation interface.

### 2. Emergency Scenario Simulation
- Emergency response scenarios.
- Patient assessment and triage simulations.
- Cardiac and trauma-related training scenarios.
- Interactive scenario selection and management.

### 3. Patient Monitoring
- Simulated patient health conditions.
- Patient status and vital parameter monitoring.
- Dynamic patient condition simulation.
- Patient assessment through interactive scenarios.

### 4. Responder Management
- Trainee and responder management.
- Responder avatar customisation.
- Training challenges and skill progression.
- Mission and scenario management.

### 5. Performance Analytics and Assessment
- Trainee performance tracking.
- Response time monitoring.
- Recording of actions and errors.
- Assessment scores and feedback.
- Training history and performance reports.
- After-action review of completed simulations.

### 6. Session Management
- Training session tracking.
- Session records and history.
- Activity and performance monitoring.
- Review of previous simulation attempts.

## Technology Stack

| Category | Technologies |
|---|---|
| Frontend | React, TypeScript |
| 3D Environment | Three.js, React Three Fiber |
| 3D Components | React Three Drei |
| Styling | Tailwind CSS |
| Backend | Node.js, Express.js |
| Development Tool | Vite |
| Data Visualisation | Recharts |
| Icons | Lucide React |
| AI Integration | Google Gemini API |
| PDF Reports | jsPDF |

## System Architecture

The platform consists of the following major components:

1. **User Interface:** Provides the main dashboard, navigation, and simulation controls.
2. **Simulation Engine:** Handles emergency scenarios and interactive training activities.
3. **Patient Engine:** Manages simulated patient conditions and health parameters.
4. **Assessment Engine:** Evaluates trainee actions and generates performance feedback.
5. **Progression Engine:** Manages trainee progress, challenges, and skill development.
6. **Storage Service:** Handles application data and session-related records.
7. **Analytics Module:** Presents performance statistics and training reports.

## Project Structure

```text
Design-Project/
│
├── App.tsx
├── main.tsx
├── server.ts
├── index.css
│
├── assessmentEngine.ts
├── patientEngine.ts
├── progressionEngine.ts
├── simulation.ts
├── storageService.ts
├── scenarioVisuals.ts
├── immersiveAudioEngine.ts
├── soundEffects.ts
│
├── EmergencyRoomScene.tsx
├── HospitalEnvironmentAssets.tsx
├── MedicalEquipmentAssets.tsx
├── HumanoidCharacter.tsx
├── FirstPersonResponderRig.tsx
│
├── OverviewView.tsx
├── SimulationCentreView.tsx
├── ScenarioLibraryView.tsx
├── ScenarioStudioView.tsx
├── PerformanceAnalyticsView.tsx
├── TraineeManagementView.tsx
├── MissionRecordsView.tsx
├── SessionReplayView.tsx
├── ReportsView.tsx
│
├── package.json
├── tsconfig.json
├── vite.config.ts
└── README.md
```

## Installation and Setup

### Prerequisites

- Node.js
- npm
- Git
- Visual Studio Code (recommended)

### Step 1: Clone the Repository

```bash
git clone https://github.com/ojal-05/Design-Project.git
```

### Step 2: Navigate to the Project Folder

```bash
cd Design-Project
```

### Step 3: Install Dependencies

```bash
npm install
```

### Step 4: Configure Environment Variables

If using Google Gemini API features, create a `.env.local` file in the project root and configure:

```env
GEMINI_API_KEY=your_gemini_api_key
```

Do not upload your actual API key to GitHub.

### Step 5: Start the Application

```bash
npm run dev
```

Open the local URL displayed in your terminal to access the application.

## Running the Build

To create a production build:

```bash
npm run build
```

To run the TypeScript checks:

```bash
npm run lint
```

## Expected Outcomes

- An interactive healthcare training and emergency simulation platform.
- Improved opportunities for practising emergency response procedures.
- A structured method for evaluating trainee performance.
- Performance reports that help identify strengths and areas for improvement.
- A foundation for future AR/VR headset integration.

## Future Enhancements

- Integration with VR headsets for fully immersive training.
- AR-based interaction with virtual medical equipment.
- More advanced patient behaviour and physiological simulations.
- Expanded emergency scenarios and clinical training modules.
- Improved AI-assisted assessment and personalised feedback.
- Multi-user collaborative emergency response simulations.

## Project Information

**Project Title:** AR/VR-Based Immersive Healthcare Training and Emergency Response Simulator

**Project Domain:** Healthcare Technology, Augmented Reality, Virtual Reality, and Interactive Simulation

**Repository:** [Design-Project](https://github.com/ojal-05/Design-Project)

**AI Studio Application:** [View Application](https://aistudio.google.com/apps/0d98b5a4-826d-4ce9-b71a-cbf8050c0a0d)

---

*This project is developed as an academic design project exploring the application of immersive technologies and interactive simulation in healthcare education and emergency response training.*
