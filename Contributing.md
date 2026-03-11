# Contributing to Note Navigation

First off, thank you for considering contributing! Note Navigation exists to bridge the gap between abstract music theory and intuitive musical expression, helping make musical fluency accessible to everyone.

## Pedagogical North Star

Before contributing, it is helpful to understand our core philosophy:

- **Ear-First**: We believe in "Sound Before Symbol." Tools should encourage audiation (hearing music in the mind) rather than just memorising visual patterns.
- **Systems Thinking**: We view music as a logical system of relationships and intervals.
- **Inclusivity**: We build for the "Midlife Muso" and the adult learner, ensuring that complex concepts are demystified through clear, spatial visualisations.

## How You Can Help

### 1. Reporting Bugs
If you find a technical glitch or a musical inaccuracy (e.g., an incorrect overtone calculation or a rendering error in a fretboard view):
- Open an Issue using the provided template.
- Include steps to reproduce and, if possible, the musical context (key, instrument, or specific interval).

### 2. Feature Requests
We welcome ideas that enhance musical understanding. Please explain the "Why" behind the feature.
Example: "Adding a 'Negative Harmony' toggle would help users visualise non-diatonic relationships spatially."

### 3. Code Contributions
- Fork the repo and create your branch from `main`.
- **Maintain the abstraction**: Keep musical logic (intervals, frequency math, scales) separate from UI components. This ensures our "musical engine" can stay portable.
- **Visual Consistency**: Ensure that geometric shapes represent intervals consistently.
- **Write Clean Code**: We prefer readability and clear naming conventions over "clever" one-liners.

## Style Guidelines
- **Language**: Please use British English for all documentation and user-facing strings (e.g., *visualise* instead of *visualize*, *colour* instead of *color*).
- **Formatting**: Avoid the use of em dashes (—). Use spaced hyphens ( - ) instead.
- **Testing**: Ensure any changes to the note-engine include unit tests to prevent "musical regressions" (like a flattened second accidentally appearing as a sharp).

## Community & Conduct
We aim to foster a collaborative environment that is as supportive as a one-on-one coaching session. Please be respectful, patient, and encouraging to fellow contributors. We follow the Contributor Covenant.

## Getting Started

If you want to work locally using your own IDE, you can clone this repo and push changes. The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

```sh
# Step 1: Clone the repository
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory
cd <YOUR_PROJECT_NAME>

# Step 3: Install dependencies
npm i

# Step 4: Start the development server
npm run dev
```
