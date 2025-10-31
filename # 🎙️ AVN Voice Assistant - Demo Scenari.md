# 🎙️ AVN Voice Assistant - Demo Scenarios

Voici une démo complète et engageante pour présenter votre assistant vocal pour personnes malvoyantes.

## 🎬 Demo Structure (10-15 minutes)

### Introduction (1 min)
"Hello everyone. Today I'm presenting AVN - an AI-powered voice assistant designed specifically for visually impaired users. AVN enables hands-free web navigation, intelligent search, content reading with interruptions, and form filling - all through natural voice commands."

## 📋 Scenario 1: News Discovery & Navigation (3-4 min)

**Setup:** Start on Google homepage

**User:** "Hey AVN, what's the latest news about space exploration?"

**AVN:** 🔍 "I found 3 recent articles about space exploration:
- Article 1: NASA announces new Mars mission for 2026
- Article 2: SpaceX successfully launches Starship prototype
- Article 3: James Webb Telescope discovers Earth-like exoplanet

Would you like me to open one of these articles?"

**User:** "Yes, open the second article about SpaceX."

**AVN:** 🧭 "Confirmed. I'm taking you to the SpaceX Starship article. Would you like me to start reading the introduction?"

**User:** "Yes, read the full article."

**AVN:** 📖 "[Starts reading] SpaceX has achieved another milestone in space exploration with the successful launch of its Starship prototype. The launch took place early this morning from the Starbase facility in Texas..."

**[DÉMO KEY FEATURE]:** Pendant la lecture, interrompre pour poser une question.

## 📋 Scenario 2: Intelligent Interruption & Clarification (3-4 min)

**During reading:**

**User:** [Interrupts] "Wait, what is Starship exactly?"

**AVN:** ⏸️ "Starship is SpaceX's fully reusable spacecraft designed for missions to Mars and beyond. It's the largest rocket ever built, standing 120 meters tall. Does this answer satisfy you? Reply 'yes' to resume reading or ask another question."

**User:** "How much can it carry?"

**AVN:** 💬 "Starship can carry over 100 tons to low Earth orbit and up to 100 passengers for interplanetary missions. Would you like me to continue reading the article?"

**User:** "Yes, continue."

**AVN:** ⏯️ "[Resumes from where it paused] ...The test flight demonstrated improved stability control systems..."

**[DÉMO KEY FEATURE]:** Montrer que l'assistant reprend exactement là où il s'était arrêté.

## 📋 Scenario 3: Generic Web Navigation (2-3 min)

**After finishing the article:**

**User:** "Navigate to the BBC News website."

**AVN:** 🌐 "Opening BBC News." [Navigue vers https://www.bbc.com/news]

**User:** "Scroll down."

**AVN:** 📜 "Scrolling the page down." [La page défile]

**User:** "Go back to the previous page."

**AVN:** ⬅️ "Going back to the previous page."


## 📋 Scenario 5: Contextual Memory & Follow-up (2 min)

**User:** "What was the first article you showed me earlier?"

**AVN:** 🧠 "The first article was about NASA's new Mars mission planned for 2026. Would you like me to open it?"

**User:** "Yes, and read just the introduction."

**AVN:** 📖 "[Reads first paragraph only] NASA has unveiled plans for an ambitious Mars mission scheduled to launch in 2026. The mission aims to search for signs of ancient microbial life..."

## 🎯 Key Features Demonstrated

| Feature | Scenario | Impact |
|---------|----------|--------|
| ✅ Intelligent Search | Scenario 1 | Natural language queries with ranked results |
| ✅ Smart Navigation | Scenarios 1, 3 | Direct URL navigation + generic site names |
| ✅ Contextual Reading | Scenarios 2, 5 | Full article, introduction only, or specific sections |
| ✅ Interruption Handling | Scenario 2 | Natural conversation during reading with resume capability |
| ✅ Conversation Memory | Scenario 5 | Remember previous searches and context |
| ✅ Page Navigation | Scenario 3 | Scroll, back/forward navigation |

## 💡 Demo Tips

### For Live Presentation:
- **Start with closed eyes:** "Let me demonstrate how a visually impaired person would use this..."
- **Show the browser side-by-side:** Split screen with the extension popup + the browser
- **Highlight the interruption:** This is the most impressive feature - practice the timing!
- **Use real websites:** BBC News, Wikipedia, Google - familiar to everyone
- **End with impact:** "Imagine being able to browse the web as naturally as asking a friend for help."

### Technical Checklist:
- ✅ Backend server running (`python server.py`)
- ✅ Extension loaded in Chrome
- ✅ Google API keys configured
- ✅ Audio output working (test TTS beforehand)
- ✅ Microphone permissions granted
- ✅ Test the "Hey AVN" hotword activation

## 🎤 Optional: Advanced Scenario (If Time Permits)

**User:** "Find me a recipe for chocolate cake, open the first result, and read me the ingredients list."

**AVN:** 🍰 [Searches → Navigates → Reads specific section]

This shows multi-step task execution and section-specific reading.

## 🏁 Closing Statement

"AVN transforms web navigation from a visual task into a conversational experience. By combining LangGraph's intelligent routing, Google's Gemini AI, and natural speech synthesis, we've created an assistant that doesn't just read web pages - it understands context, answers questions, and truly assists users in achieving their goals online."