// redeploy
import React, { useState, useEffect, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import {
  getAuth,
  signInAnonymously,
  onAuthStateChanged,
  signInWithCustomToken
} from 'firebase/auth';
import type { User } from 'firebase/auth';

import { getFirestore, collection, doc, setDoc, onSnapshot, query, orderBy, Timestamp, getDoc, updateDoc, increment, arrayUnion } from 'firebase/firestore';
import { Palette, Shuffle, Sliders, Pause, Play, XCircle, VolumeX, Volume2, Box } from 'lucide-react'; 
import { 
  BookOpen, 
  Wind, 
  History, 
  ChevronLeft, 
  ChevronRight, 
  RefreshCw, 
  Quote as QuoteIcon,
  PenTool,
  Leaf,
  Share2,
  Sun,
  Cloud,
  CloudRain,
  CloudLightning,
  PlusCircle,
  Trash2,
  Copy,
  Zap,
  Droplet,
  Activity,
  PhoneOff,
  MapPin, 
  Check,
  Sparkles,
  Square,
  Settings,
  Clock,
  Target,
  Heart,
  FileText,
  Star,
  Moon,
  CheckCircle,
  AlertCircle,
  Shield,
  Layers,
  Map,
  ArrowRight,
  Brain,
  List,
  Scale,
  Tag,
  Anchor,
  Smile,
  Frown,
  Meh,
  Eye,
  Search,
  Compass,
  Key,
  Feather,
  Repeat,
  ArrowRightLeft,
  ClipboardList,
  MessageCircle,
  BarChart2,
  Mountain,
  PenLine,
  Waves,
  Users,
  TrendingUp,
  Bell,
  Theater,
  Clipboard,
  Scissors,
  Filter,
  Wrench,
  SlidersHorizontal,
  BrickWall,
  LifeBuoy,
  ShieldCheck,
  SplitSquareVertical,
  Telescope,
  Workflow,
  Footprints,
  MousePointer2,
  Type,
  Maximize2,
  Book,
  Headphones,
  MonitorPlay,
  Smartphone
} from 'lucide-react';

console.log('DEBUG CHECK', {
  appId: (window as any).__app_id,
  firebaseConfig: (window as any).__firebase_config,
});

// --- Firebase Setup ---
let app: any = null;
let auth: any = null;
let db: any = null;
const FIREBASE_ENABLED = false;
const appId = (typeof window !== 'undefined' && (window as any).__app_id) ? (window as any).__app_id : 'default-app';

try {
  const configStr =
    (typeof window !== 'undefined' && (window as any).__firebase_config)
      ? (window as any).__firebase_config
      : '{}';

  const config = JSON.parse(configStr);

  if (config.apiKey) {
    app = initializeApp(config);
    auth = getAuth(app);
    db = getFirestore(app);
    console.log('Firebase enabled');
  } else {
    console.warn('Firebase disabled — running in mock mode');
  }
} catch (e) {
  console.error('Firebase init failed (expected in local dev without config):', e);
}

// --- Gemini API Helper ---
const GEMINI_API_KEY = ""; // Injected by environment

const callGemini = async (prompt: string, systemPrompt: string = "") => {
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          systemInstruction: { parts: [{ text: systemPrompt }] }
        })
      }
    );
    
    if (!response.ok) throw new Error('Gemini API Error');
    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || "I couldn't generate an insight right now.";
  } catch (error) {
    console.error("Gemini Error:", error);
    return "The stars are cloudy right now. Please try again later.";
  }
};

const callGeminiTTS = async (text: string): Promise<string | null> => {
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: text }] }],
          generationConfig: {
            responseModalities: ["AUDIO"],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName: "Kore" }
              }
            }
          }
        })
      }
    );

    if (!response.ok) throw new Error('Gemini TTS API Error');
    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data || null;
  } catch (error) {
    console.error("Gemini TTS Error:", error);
    return null;
  }
};

// --- Audio Engine (Web Audio API) ---
class AudioEngine {
  ctx: AudioContext | null = null;
  noiseNode: AudioBufferSourceNode | null = null;
  breathGain: GainNode | null = null;
  filterNode: BiquadFilterNode | null = null;
  reverbNode: ConvolverNode | null = null;
  masterGain: GainNode | null = null;
  isMuted: boolean = false;

  init() {
    if (typeof window === 'undefined') return;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
        this.setupGraph();
      }
    } else if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  setupGraph() {
    if (!this.ctx) return;
    
    this.masterGain = this.ctx.createGain();
    this.masterGain.connect(this.ctx.destination);
    
    // Breath Synth (Pink Noise)
    const bufferSize = this.ctx.sampleRate * 2; 
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let b0=0, b1=0, b2=0, b3=0, b4=0, b5=0, b6=0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      b3 = 0.86650 * b3 + white * 0.3104856;
      b4 = 0.55000 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.0168980;
      data[i] = b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362;
      data[i] *= 0.11; 
      b6 = white * 0.115926;
    }

    this.noiseNode = this.ctx.createBufferSource();
    this.noiseNode.buffer = buffer;
    this.noiseNode.loop = true;

    this.filterNode = this.ctx.createBiquadFilter();
    this.filterNode.type = 'lowpass';
    this.filterNode.frequency.value = 100;

    this.breathGain = this.ctx.createGain();
    this.breathGain.gain.value = 0;

    // Stronger Reverb Impulse
    this.reverbNode = this.ctx.createConvolver();
    this.reverbNode.buffer = this.impulseResponse(4, 3); 

    // Graph Wiring
    this.noiseNode.connect(this.filterNode);
    this.filterNode.connect(this.breathGain);
    
    // Wet/Dry Mix
    this.breathGain.connect(this.masterGain); 
    this.breathGain.connect(this.reverbNode); 
    this.reverbNode.connect(this.masterGain); 
    
    this.noiseNode.start();
  }

  impulseResponse(duration: number, decay: number) {
    if (!this.ctx) return null;
    const rate = this.ctx.sampleRate;
    const length = rate * duration;
    const impulse = this.ctx.createBuffer(2, length, rate);
    const left = impulse.getChannelData(0);
    const right = impulse.getChannelData(1);
    for (let i = 0; i < length; i++) {
        const n = i / length;
        const val = (Math.random() * 2 - 1) * Math.pow(1 - n, decay);
        left[i] = val;
        right[i] = val;
    }
    return impulse;
  }

  setBreathIntensity(intensity: number, phase: string) { 
    if (!this.ctx || !this.breathGain || !this.filterNode || this.isMuted) return;
    
    const now = this.ctx.currentTime;
    
    // Silence during holds
    if (phase === 'Hold' || phase === 'HoldEmpty') {
        this.breathGain.gain.setTargetAtTime(0, now, 0.1);
        return;
    }

    // Inhale (Higher pitch) vs Exhale (Lower pitch)
    const baseFreq = phase === 'Inhale' ? 150 : 80; 
    const freqMod = phase === 'Inhale' ? 400 : 150;
    
    const targetGain = Math.max(0, intensity * 0.6); 
    const targetFreq = baseFreq + (intensity * freqMod); 
    
    this.breathGain.gain.setTargetAtTime(targetGain, now, 0.2);
    this.filterNode.frequency.setTargetAtTime(targetFreq, now, 0.2);
  }

  playPhaseCue() {
    if (!this.ctx || this.isMuted || !this.masterGain) return;
    const t = this.ctx.currentTime;
    
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    
    osc.connect(gain);
    gain.connect(this.masterGain);
    
    // Distinct Phase Click
    osc.type = 'sine';
    osc.frequency.setValueAtTime(600, t);
    osc.frequency.exponentialRampToValueAtTime(300, t + 0.1);
    
    gain.gain.setValueAtTime(0.1, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
    
    osc.start(t);
    osc.stop(t + 0.1);
  }

  playHeartbeat() {
    if (!this.ctx || this.isMuted || !this.masterGain) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.connect(gain);
    gain.connect(this.masterGain);
    
    // Sub-bass Heartbeat
    osc.frequency.setValueAtTime(80, t);
    osc.frequency.exponentialRampToValueAtTime(40, t + 0.15);
    
    gain.gain.setValueAtTime(0.3, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
    
    osc.start(t);
    osc.stop(t + 0.15);
  }

  stopAll() {
      if (this.masterGain && this.ctx) {
          this.masterGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.1);
      }
  }

  toggleMute(muted: boolean) {
    this.isMuted = muted;
    if (this.masterGain && this.ctx) {
        this.masterGain.gain.setTargetAtTime(muted ? 0 : 1, this.ctx.currentTime, 0.1);
    }
  }
}

// Lazy Singleton for Audio
let _audioEngine: AudioEngine | null = null;
const getAudioEngine = () => {
  if (typeof window === 'undefined') return null;
  if (!_audioEngine) {
    _audioEngine = new AudioEngine();
  }
  return _audioEngine;
};

// --- Data & Content ---

const QUOTES = [
  { text: "The wound is the place where the Light enters you.", author: "Rumi" },
  { text: "Between stimulus and response there is a space. In that space is our power to choose.", author: "Viktor Frankl" },
  { text: "You are not a drop in the ocean. You are the entire ocean in a drop.", author: "Rumi" },
  { text: "Peace comes from within. Do not seek it without.", author: "Buddha" },
  { text: "The present moment is the only time over which we have dominion.", author: "Thích Nhất Hạnh" },
  { text: "Knowing yourself is the beginning of all wisdom.", author: "Aristotle" },
  { text: "What you seek is seeking you.", author: "Rumi" },
  { text: "Silence is a source of great strength.", author: "Lao Tzu" },
  { text: "When you let go of who you think you should be, you become who you are.", author: "Joseph Campbell" },
  { text: "The quieter you become, the more you can hear.", author: "Ram Dass" },
  { text: "Be here now.", author: "Ram Dass" },
  { text: "Wherever you are, be there totally.", author: "Eckhart Tolle" },
  { text: "Life is available only in the present moment.", author: "Thích Nhất Hạnh" },
  { text: "The best way to predict the future is to create it.", author: "Peter Drucker" },
  { text: "Your task is not to seek for love, but merely to seek and find all the barriers within yourself.", author: "Rumi" },
  { text: "Do not feel lonely, the entire universe is inside you.", author: "Rumi" },
  { text: "We don’t see things as they are, we see them as we are.", author: "Anaïs Nin" },
  { text: "The privilege of a lifetime is to become who you truly are.", author: "Carl Jung" },
  { text: "Awareness is the greatest agent for change.", author: "Eckhart Tolle" },
  { text: "Knowing how to be solitary is central to the art of loving.", author: "bell hooks" },
  { text: "Real generosity toward the future lies in giving all to the present.", author: "Albert Camus" },
  { text: "You have power over your mind — not outside events. Realize this, and you will find strength.", author: "Marcus Aurelius" },
  { text: "The mind is everything. What you think you become.", author: "Buddha" },
  { text: "In the middle of difficulty lies opportunity.", author: "Albert Einstein" },
  { text: "Simplicity is the ultimate sophistication.", author: "Leonardo da Vinci" },
  { text: "The future is already here — it’s just not evenly distributed.", author: "William Gibson" },
  { text: "If you want to conquer the anxiety of life, live in the moment.", author: "Amit Ray" },
  { text: "What we pay attention to becomes our experience.", author: "William James" },
  { text: "Slow down and everything you are chasing will come around and catch you.", author: "John De Paola" },
  { text: "When you realize nothing is lacking, the whole world belongs to you.", author: "Lao Tzu" },
  { text: "The only journey is the one within.", author: "Rainer Maria Rilke" },
  { text: "To live is the rarest thing in the world. Most people exist, that is all.", author: "Oscar Wilde" },
  { text: "Attention is the rarest and purest form of generosity.", author: "Simone Weil" },
  { text: "You cannot stop the waves, but you can learn to surf.", author: "Jon Kabat-Zinn" },
  { text: "The most important relationship you will ever have is the one with yourself.", author: "Diane von Furstenberg" },
  { text: "Don’t believe everything you think.", author: "Unknown" },
  { text: "Your vision will become clear only when you look into your heart.", author: "Carl Jung" },
  { text: "Stillness is where creativity and solutions are found.", author: "Eckhart Tolle" },
  { text: "Presence is far more intricate and rewarding than productivity.", author: "Maria Popova" },
  { text: "The art of resting is a part of the art of working.", author: "John Steinbeck" },
  { text: "To be calm is the highest achievement of the self.", author: "Zen Proverb" },
  { text: "What matters most is how well you walk through the fire.", author: "Charles Bukowski" },
  { text: "Your life does not get better by chance, it gets better by change.", author: "Jim Rohn" },
  { text: "We are shaped by our thoughts; we become what we think.", author: "Buddha" },
  { text: "Clarity comes from engagement, not thought.", author: "Marie Forleo" },
  { text: "The way out is through.", author: "Robert Frost" },
  { text: "A calm mind brings inner strength and self-confidence.", author: "Dalai Lama" },
  { text: "When you are present, fear dissolves.", author: "Eckhart Tolle" },
  { text: "In today already walks tomorrow.", author: "Samuel Taylor Coleridge" },
  { text: "Act as if what you do makes a difference. It does.", author: "William James" },
  { text: "The soul becomes dyed with the color of its thoughts.", author: "Marcus Aurelius" },
  { text: "Almost everything will work again if you unplug it for a few minutes, including you.", author: "Anne Lamott" },
  { text: "Do not let the noise of others’ opinions drown out your own inner voice.", author: "Steve Jobs" },
  { text: "What lies behind us and what lies before us are tiny matters compared to what lies within us.", author: "Ralph Waldo Emerson" },
  { text: "You can’t calm the storm, so stop trying. What you can do is calm yourself.", author: "Timber Hawkeye" },
  { text: "The greatest weapon against stress is our ability to choose one thought over another.", author: "William James" },
  { text: "Your heart knows the way. Run in that direction.", author: "Rumi" },
  { text: "Stillness reveals what the mind cannot.", author: "Adyashanti" },
  { text: "We are not human beings having a spiritual experience. We are spiritual beings having a human experience.", author: "Pierre Teilhard de Chardin" },
  { text: "Nothing diminishes anxiety faster than action.", author: "Walter Anderson" },
  { text: "The deeper the sorrow, the greater the joy.", author: "Kahlil Gibran" },
  { text: "You are allowed to be both a masterpiece and a work in progress.", author: "Sophia Bush" },
  { text: "Let yourself be silently drawn by the strange pull of what you really love.", author: "Rumi" },
  { text: "Do one thing every day that scares you.", author: "Eleanor Roosevelt" },
  { text: "The moment you change your perception is the moment you rewrite the chemistry of your body.", author: "Bruce Lipton" },
  { text: "The path isn’t a straight line; it’s a spiral. You continually come back to things you thought you understood.", author: "Barry H. Gillespie" },
  { text: "Trust the process.", author: "Unknown" },
  { text: "Everything that irritates us about others can lead us to an understanding of ourselves.", author: "Carl Jung" },
  { text: "Be soft. Do not let the world make you hard.", author: "Iain Thomas" },
  { text: "The obstacle is the path.", author: "Zen Proverb" },
  { text: "Patience is not passive; it is focused strength.", author: "Bruce Lee" },
  { text: "Growth is uncomfortable because you’ve never been here before.", author: "Unknown" },
  { text: "Breathe. Let go. And remind yourself that this very moment is the only one you know you have for sure.", author: "Oprah Winfrey" },
  { text: "The body benefits from movement, and the mind benefits from stillness.", author: "Sakyong Mipham" },
  { text: "Awakening is not changing who you are, but discarding who you are not.", author: "Deepak Chopra" },
  { text: "Small steps taken consistently create profound change.", author: "Unknown" },
  { text: "Nothing is worth more than this day.", author: "Johann Wolfgang von Goethe" },
  { text: "Live the questions now.", author: "Rainer Maria Rilke" },
  { text: "Peace is every step.", author: "Thích Nhất Hạnh" },
  { text: "Where attention goes, energy flows.", author: "James Redfield" },
  { text: "You don’t have to control your thoughts. You just have to stop letting them control you.", author: "Dan Millman" },
  { text: "To understand everything is to forgive everything.", author: "Buddha" },
  { text: "Gentleness is the antidote to cruelty.", author: "Pema Chödrön" },
  { text: "When we are no longer able to change a situation, we are challenged to change ourselves.", author: "Viktor Frankl" },
  { text: "Mindfulness isn’t difficult. What’s difficult is remembering to be mindful.", author: "Sharon Salzberg" },
  { text: "Your calm mind is the ultimate weapon against your challenges.", author: "Bryant McGill" }
];

const PROMPTS = [
  "What is one small thing I can do today to make my life better?",
  "Who am I grateful for and why?",
  "What energy do I want to bring into this room today?",
  "What is a challenge I am currently facing, and what is it teaching me?",
  "Describe a moment recently where you felt truly at peace.",
  "What would I do today if I knew I could not fail?",
  "How can I be kinder to myself today?",
  "What is nature trying to tell me right now?",
  "Write about a coincidence that felt meaningful.",
];

// --- Icon Mapping ---
const ICON_MAP: { [key: string]: any } = {
  Heart, Sun, Tag, Layers, CloudLightning, Scale, List, Shield, Brain, AlertCircle,
  FileText, MapPin, Star, Share2, Target, Anchor, Smile, Frown, Meh, Eye, Search, Compass, Key,
  Feather, Repeat, ArrowRightLeft, Box, ClipboardList, MessageCircle, BarChart2, Mountain,
  PenLine, Waves, Users, CheckCircle, TrendingUp, Bell, Theater, Clipboard, Scissors,
  Filter, Wrench, SlidersHorizontal, BrickWall, LifeBuoy, ShieldCheck, SplitSquareVertical,
  Telescope, Workflow, Footprints, RefreshCw, Cloud, Moon, Zap, Leaf, Droplet, Wind, BookOpen, Clock, Activity, Square, Play
};

// --- DATA: CBT TOOLS (Full 50+ List) ---
const CBT_TEACHINGS = [
  { title: "The 'Friend' Test", icon: "Heart", desc: "Distance yourself from the thought to see it clearly.", list: ["Notice a harsh thought.", "Ask: 'Would I say this to a friend?'", "Rephrase kindly."], footer: "Self-compassion is reality testing.", interactive: true, question: "Rewrite your harsh thought as if speaking to a friend." },
  { title: "Fact vs. Opinion", icon: "Sun", desc: "Distinguish facts from opinions to reduce anxiety.", list: ["Write thought.", "Underline facts.", "Rewrite as opinion."], footer: "Thoughts can be loud. Facts are usually quieter.", interactive: true, question: "Write one 'Opinion' vs the cold 'Fact'." },
  { title: "Name the Distortion", icon: "Tag", desc: "Labeling a thinking pattern reduces its grip.", list: ["Catch thought.", "Identify distortion.", "Say: 'Brain is doing ___.'"], footer: "Name it to tame it.", interactive: true, question: "What distortion is your mind using right now?" },
  { title: "Cognitive Triangle", icon: "Layers", desc: "Thoughts, feelings, and behaviors are interconnected.", list: ["Situation.", "Thought.", "Feeling.", "Action."], footer: "Change the Thought to change the Feeling.", interactive: true, question: "Identify the 'Thought' that triggered your bad feeling." },
  { title: "Catastrophizing", icon: "CloudLightning", desc: "Jumping to the worst possible conclusion.", list: ["Failed test -> Homeless.", "Stop spiral.", "Ask most likely outcome."], footer: "The worst-case rarely happens.", interactive: true, question: "What is a realistic outcome?" },
  { title: "All-or-Nothing", icon: "Scale", desc: "Viewing situations as perfect or failure.", list: ["Life isn't binary.", "Look for the 50%.", "Partial success counts."], footer: "Find the middle ground.", interactive: true, question: "What would 'good enough' look like?" },
  { title: "Cost-Benefit", icon: "List", desc: "We hold thoughts because they serve a purpose.", list: ["Benefits of thought?", "Costs of thought?", "Is it worth it?"], footer: "Choose thoughts like clothes.", interactive: true, question: "Do the costs of this thought outweigh the benefits?" },
  { title: "Double Standard", icon: "Shield", desc: "Why are you harder on yourself than others?", list: ["Would you judge a stranger?", "Be fair."], footer: "Be fair to yourself.", interactive: true, question: "Name one rule you have for yourself but not others." },
  { title: "Mind Reading", icon: "Brain", desc: "Assuming you know what people think.", list: ["'They think I'm boring.'", "Not telepathic.", "Don't project."], footer: "Unless they said it, you made it up.", interactive: true, question: "What evidence do you have they actually think that?" },
  { title: "Emotional Reasoning", icon: "AlertCircle", desc: "Believing feelings are facts.", list: ["'I feel stupid, so I am.'", "Feelings are weather."], footer: "You are the sky, feelings are weather.", interactive: true, question: "Just because I feel ____ doesn't mean I am ____." },
  { title: "Labeling", icon: "FileText", desc: "Assigning global labels to yourself.", list: ["'I am a failure' vs 'I failed'.", "Labels are static."], footer: "Drop the label.", interactive: true, question: "What specific action actually happened?" },
  { title: "Grounding 5-4-3-2-1", icon: "MapPin", desc: "Bring yourself back to the present.", list: ["5 see", "4 feel", "3 hear", "2 smell", "1 taste"], footer: "Peace lives in the present.", interactive: true, question: "List 5 things you see right now." },
  { title: "Gratitude Savoring", icon: "Star", desc: "Relive the moment in detail.", list: ["Pick moment.", "Visualise details.", "Feel emotion."], footer: "Depth over breadth.", interactive: true, question: "Describe one good moment vividly." },
  { title: "Survey Method", icon: "Share2", desc: "Test your negative belief by asking others.", list: ["'Everyone thinks X'.", "Ask 3 people.", "Gather data."], footer: "Be a scientist of your own life.", interactive: true, question: "What assumption can you test?" },
  { title: "Control", icon: "Target", desc: "Anxiety comes from trying to control the uncontrollable.", list: ["Circle of Control.", "Circle of Concern."], footer: "Let go of the rest.", interactive: true, question: "List one thing you CAN control." },
  { title: "10–10–10 Rule", icon: "Clock", desc: "Widen your time horizon.", list: ["10 mins?", "10 hours?", "10 days?"], footer: "Time turns volume down.", interactive: true, question: "How will you feel about this in 10 days?" },
  { title: "'Yet' Reframe", icon: "Sparkles", desc: "Add 'yet' to keep growth possible.", list: ["Find stuck statement.", "Add 'yet'.", "Name practice step."], footer: "Not now isn't never.", interactive: true, question: "What is one skill you can practice to move forward?" },
  { title: "Behavior First", icon: "Activity", desc: "Do the smallest action first.", list: ["Pick tiny task.", "Do it now.", "Notice mood change."], footer: "Action is a mood elevator.", interactive: true, question: "What is one tiny task you can do right now?" },
  { title: "Opposite Action", icon: "ArrowRightLeft", desc: "Choose the healthy opposite of your urge.", list: ["Name urge.", "Is it helpful?", "Do opposite."], footer: "You can feel one thing and do another.", interactive: true, question: "What is the opposite healthy behavior?" },
  { title: "Worry Time", icon: "Box", desc: "Contain rumination.", list: ["Set 10min window.", "Write worry now.", "Review later."], footer: "Contain worry; reclaim attention.", interactive: true, question: "Write down your current worry to review later." },
  { title: "Thought Labeling", icon: "MessageCircle", desc: "Create distance from thoughts.", list: ["'I'm having the thought that...'", "Say slowly.", "Notice shift."], footer: "Distance creates choice.", interactive: true, question: "Complete: 'I am having the thought that...'" },
  { title: "Probability", icon: "BarChart2", desc: "Ground fear in numbers.", list: ["Name fear.", "Estimate %.", "Check history."], footer: "Fear is a storyteller, not a statistician.", interactive: true, question: "What is your revised probability estimate?" },
  { title: "Coping Card", icon: "Shield", desc: "Remind your brain of your track record.", list: ["Name fear.", "List past successes.", "'If it happens, I can...'"], footer: "Coping is a skill you've proven.", interactive: true, question: "Complete: 'If it happens, I can...'" },
  { title: "Catastrophe Ladder", icon: "Mountain", desc: "Follow 'what if' to the bottom.", list: ["Write fear.", "Ask 'Then what?'", "Find control point."], footer: "Clarity breaks the spell.", interactive: true, question: "What is one practical step you can take?" },
  { title: "Self-Talk", icon: "PenLine", desc: "Rewrite your inner tone.", list: ["Write self-talk.", "Identify harshness.", "Rewrite kindly."], footer: "Same truth, kinder delivery.", interactive: true, question: "Rewrite your harsh self-talk as kind coaching." },
  { title: "Label Feeling", icon: "Droplet", desc: "Naming emotions reduces intensity.", list: ["Ask 'What emotion?'", "Name precisely.", "Rate 0-10."], footer: "Name it and it softens.", interactive: true, question: "What emotion is present and what is its rating?" },
  { title: "Body Scan", icon: "Waves", desc: "Scan and release tension.", list: ["Scan body.", "Unclench one area.", "Exhale long."], footer: "Relax the body; the mind follows.", interactive: true, question: "Which area of your body did you relax?" },
  { title: "Pause Breath", icon: "Wind", desc: "Physiological reset.", list: ["Inhale 4.", "Hold 2.", "Exhale 6.", "Repeat 3x."], footer: "Breath creates space.", interactive: true, question: "How do you feel after 3 rounds?" },
  { title: "Neutral Narrator", icon: "BookOpen", desc: "Describe like a camera.", list: ["Describe situation.", "Remove labels.", "Write step."], footer: "Neutral language reduces fuel.", interactive: true, question: "Write one neutral next step." },
  { title: "Comparison", icon: "Users", desc: "Stop comparing insides to outsides.", list: ["Notice comparison.", "List your strengths.", "Choose lane."], footer: "Stay in your lane.", interactive: true, question: "List 3 strengths you have." },
  { title: "Perfectionism", icon: "CheckCircle", desc: "Aim for 'effective'.", list: ["Define 'done'.", "Set timer.", "Ship 'good enough'."], footer: "Done is self-trust.", interactive: true, question: "What does 'good enough' look like?" },
  { title: "1% Better", icon: "TrendingUp", desc: "Shrink the target.", list: ["Pick smallest step.", "Do it now.", "Stop."], footer: "Tiny steps compound.", interactive: true, question: "What is the smallest step right now?" },
  { title: "Choice Point", icon: "Compass", desc: "Move toward values.", list: ["Name trigger.", "Toward or Away?", "Choose toward."], footer: "Freedom lives at the choice point.", interactive: true, question: "What is one 'toward' action?" },
  { title: "Values Align", icon: "Target", desc: "Values provide direction.", list: ["Pick value.", "Ask 'What's next?'", "Commit 5 mins."], footer: "Values are a compass.", interactive: true, question: "What does your value do next?" },
  { title: "Validate", icon: "Heart", desc: "Validate feelings first.", list: ["'It makes sense.'", "Name emotion.", "Choose healthy act."], footer: "Validation reduces conflict.", interactive: true, question: "What do you need right now?" },
  { title: "Shame Signal", icon: "Bell", desc: "Convert shame to info.", list: ["Name shame.", "Find unmet need.", "Choose repair."], footer: "Shame is a signal.", interactive: true, question: "What is the unmet need?" },
  { title: "Rename Critic", icon: "Theater", desc: "Externalize the voice.", list: ["Name critic.", "Notice it.", "Choose wise voice."], footer: "A named voice is easier to defuse.", interactive: true, question: "What is your critic's name?" },
  { title: "Parking Lot", icon: "Clipboard", desc: "Park thoughts safely.", list: ["Write thought.", "Label 'Later'.", "Return to task."], footer: "Write it to release it.", interactive: true, question: "Write down the parked thought." },
  { title: "Rumination", icon: "Scissors", desc: "Solve or Soothe?", list: ["Notice loop.", "Solve or Soothe?", "Take step."], footer: "Change the channel.", interactive: true, question: "Solve or Soothe? What step?" },
  { title: "Assumption", icon: "Filter", desc: "Separate guess from fact.", list: ["Write situation.", "List observations.", "List assumptions."], footer: "Observations are real.", interactive: true, question: "Rewrite using only observations." },
  { title: "Worst Case", icon: "Wrench", desc: "Give fear a plan.", list: ["Name worst case.", "List plan.", "List resources."], footer: "Plans calm.", interactive: true, question: "List 3 things you'd do." },
  { title: "Precision", icon: "SlidersHorizontal", desc: "Swap vague for precise.", list: ["Find global word.", "Describe facts.", "Choose fix."], footer: "Precision reduces panic.", interactive: true, question: "Describe in one concrete sentence." },
  { title: "Gratitude", icon: "Star", desc: "Balance negativity bias.", list: ["Name appreciation.", "Name why.", "Feel it."], footer: "Noticing good is a skill.", interactive: true, question: "What do you appreciate and why?" },
  { title: "Self-Trust", icon: "BrickWall", desc: "Keep small promises.", list: ["Choose tiny promise.", "Do it.", "Mark done."], footer: "Trust is built.", interactive: true, question: "What tiny promise will you keep?" },
  { title: "Repair", icon: "LifeBuoy", desc: "Move to repair.", list: ["Name mistake.", "Ask repair.", "Do action."], footer: "Punishment doesn't teach.", interactive: true, question: "What is one repair action?" },
  { title: "Permission", icon: "Cloud", desc: "Allow feelings.", list: ["'This is allowed.'", "Locate in body.", "Breathe."], footer: "What you allow moves.", interactive: true, question: "Where do you feel it?" },
  { title: "Courage", icon: "Zap", desc: "Tiny exposures.", list: ["Pick avoided thing.", "Do 60s.", "Notice survival."], footer: "Courage is a practice.", interactive: true, question: "One small thing for 60s?" },
  { title: "Boundaries", icon: "ShieldCheck", desc: "Clear communication.", list: ["'I can...'", "'I can't...'", "No over-explaining."], footer: "Boundaries protect energy.", interactive: true, question: "Write your boundary script." },
  { title: "Worry vs Problem", icon: "SplitSquareVertical", desc: "Separate solvable.", list: ["Write worry.", "Action in 24h?", "Plan or accept."], footer: "Solve or soothe.", interactive: true, question: "Is there an action in 24h?" },
  { title: "Long View", icon: "Telescope", desc: "Zoom out.", list: ["Imagine 1 year.", "What matters?", "Do small version."], footer: "This is a moment.", interactive: true, question: "What will matter in 1 year?" }
];

const WEATHER_MOODS = [
  { id: 'sunny', label: 'Clear', icon: Sun, color: 'text-amber-400', bg: 'bg-amber-400/10' },
  { id: 'cloudy', label: 'Cloudy', icon: Cloud, color: 'text-gray-400', bg: 'bg-gray-400/10' },
  { id: 'rainy', label: 'Heavy', icon: CloudRain, color: 'text-blue-400', bg: 'bg-blue-400/10' },
  { id: 'stormy', label: 'Stormy', icon: CloudLightning, color: 'text-purple-400', bg: 'bg-purple-400/10' },
  { id: 'windy', label: 'Restless', icon: Wind, color: 'text-teal-400', bg: 'bg-teal-400/10' },
];

const BODY_ZONES = ['Head', 'Jaw', 'Neck', 'Shoulders', 'Chest', 'Gut', 'Back', 'Hips'];
const MOVEMENT_TYPES = ['Walk', 'Run', 'Yoga', 'Gym', 'Stretch', 'Rest'];
const DIET_TYPES = ['Nourishing', 'Balanced', 'Light', 'Indulgent', 'Processed'];

const SLEEP_QUALITY = ['Restless', 'Fair', 'Good', 'Deep'];

const BREATH_PATTERNS = [
  { id: 'box', name: 'Box (4-4-4-4)', description: 'Focus', inhale: 4, holdIn: 4, exhale: 4, holdOut: 4, colorPrimary: 'hsla(45, 90%, 60%, 1)', colorSecondary: 'hsla(10, 80%, 60%, 0.8)' },
  { id: 'relax', name: 'Relax (4-7-8)', description: 'For Anxiety', inhale: 4, holdIn: 7, exhale: 8, holdOut: 0, colorPrimary: 'hsla(220, 90%, 60%, 1)', colorSecondary: 'hsla(280, 80%, 60%, 0.8)' },
  { id: 'balance', name: 'Balance (5-5)', description: 'Coherence', inhale: 5, holdIn: 0, exhale: 5, holdOut: 0, colorPrimary: 'hsla(160, 80%, 50%, 1)', colorSecondary: 'hsla(120, 70%, 60%, 0.8)' },
  { id: 'energy', name: 'Energize (4-2)', description: 'Wake Up', inhale: 4, holdIn: 0, exhale: 2, holdOut: 0, colorPrimary: 'hsla(0, 90%, 60%, 1)', colorSecondary: 'hsla(30, 90%, 60%, 0.8)' },
];

const CBT_DISTORTIONS = [
  { id: 'all-or-nothing', label: 'All-or-Nothing', desc: 'Thinking in absolutes (always, never, perfect or fail).' },
  { id: 'catastrophizing', label: 'Catastrophizing', desc: 'Expecting the worst possible outcome.' },
  { id: 'mind-reading', label: 'Mind Reading', desc: 'Assuming you know what others think (and its bad).' },
  { id: 'emotional-reasoning', label: 'Emotional Reasoning', desc: 'I feel it, therefore it must be true.' },
  { id: 'labeling', label: 'Labeling', desc: 'Assigning global negative labels to yourself or others.' },
  { id: 'filtering', label: 'Mental Filter', desc: 'Focusing only on the negative and ignoring the positive.' },
  { id: 'overgeneralization', label: 'Overgeneralization', desc: 'Seeing a single negative event as a never-ending pattern.' },
  { id: 'personalization', label: 'Personalization', desc: 'Blaming yourself for things you are not responsible for.' },
  { id: 'shoulds', label: 'Should Statements', desc: 'Criticizing yourself or others with "should", "must", or "ought".' },
  { id: 'magnification', label: 'Magnification', desc: 'Blowing things out of proportion or shrinking their importance.' },
];

// --- Visualizer Options ---
// UPDATED: Now includes ~50 shapes (Basics + Polygons + Stars + Misc)
const PARTICLES_SHAPES = [
    // Basics
    'circle', 'square', 'triangle', 'diamond', 'line', 'cross', 'plus', 'x-mark', 'ring',
    // Polygons (Generated by Math)
    'pentagon', 'hexagon', 'heptagon', 'octagon', 'nonagon', 'decagon', 'dodecagon',
    // Stars (Generated by Math)
    'star-4', 'star-5', 'star-6', 'star-7', 'star-8', 'star-9', 'star-10', 'burst-12', 'burst-20',
    // Nature / Misc
    'heart', 'moon', 'semi-circle', 'zigzag', 'wave', 'spiral', 'sparkle'
];

const BG_STYLES = ['void', 'stars', 'dust', 'flow', 'orbit', 'rain'];

// --- 1000 COLOR PALETTES LOGIC ---

// 1. Curated List (Your existing + new curated ones)
const curatedPalettes = [
    ['#2dd4bf', '#a855f7', '#f472b6'], // Teal/Purple/Rose
    ['#f59e0b', '#ef4444', '#78350f'], // Amber/Red/DarkRed
    ['#3b82f6', '#06b6d4', '#ecfeff'], // Blue/Cyan/White
    ['#10b981', '#84cc16', '#ecfccb'], // Emerald/Lime/White
    ['#6366f1', '#8b5cf6', '#e0e7ff'], // Indigo/Violet/White
    ["#264653", "#2A9D8F", "#E9C46A", "#F4A261", "#E76F51"], // Earth & Fire
    ["#F8F9FA", "#E9ECEF", "#DEE2E6", "#CED4DA", "#ADB5BD"], // Grayscale Light
    ["#CCD5AE", "#E9EDC9", "#FEFAE0", "#FAEDCD", "#D4A373"], // Soft Nature
    ["#03045E", "#0077B6", "#00B4D8", "#90E0EF", "#CAF0F8"], // Ocean Depths
    ["#5F0F40", "#9A031E", "#FB8B24", "#E36414", "#0F4C5C"], // Deep & Vibrant
    ["#FF595E", "#FFCA3A", "#8AC926", "#1982C4", "#6A4C93"], // Rainbow Toy
    ["#8E9AAF", "#CBC0D3", "#EFD3D7", "#FEEAFA", "#DEE2FF"], // Lavender Dreams
    ["#2B2D42", "#8D99AE", "#EDF2F4", "#EF233C", "#D90429"], // Americano
    ["#606C38", "#283618", "#FEFAE0", "#DDA15E", "#BC6C25"], // Forest Hike
    ["#001219", "#005F73", "#0A9396", "#94D2BD", "#E9D8A6", "#EE9B00"], // Retro Teal
    ["#FFCDB2", "#FFB4A2", "#E5989B", "#B5838D", "#6D6875"], // Dusty Rose
    ["#CB997E", "#DDBEA9", "#FFE8D6", "#B7B7A4", "#A5A58D", "#6B705C"], // Art Studio
    ["#7400B8", "#6930C3", "#5E60CE", "#5390D9", "#4EA8DE", "#48BFE3"], // Purple Fade
    ["#355070", "#6D597A", "#B56576", "#E56B6F", "#EAAC8B"], // Sunset Vibes
    ["#E63946", "#F1FAEE", "#A8DADC", "#457B9D", "#1D3557"], // Patriot
    ["#003049", "#D62828", "#F77F00", "#FCBF49", "#EAE2B7"], // Bold Primary
    ["#F4F1DE", "#E07A5F", "#3D405B", "#81B29A", "#F2CC8F"], // Creamy Pastel
    ["#540D6E", "#EE4266", "#FFD23F", "#3BCEAC", "#0EAD69"], // Neon Nights
    ["#FFBE0B", "#FB5607", "#FF006E", "#8338EC", "#3A86FF"], // High Contrast
    ["#9B5DE5", "#F15BB5", "#FEE440", "#00BBF9", "#00F5D4"], // Cyberpunk
    ["#D8E2DC", "#FFE5D9", "#FFCAD4", "#F4ACB7", "#9D8189"], // Ballet Slipper
    ["#22223B", "#4A4E69", "#9A8C98", "#C9ADA7", "#F2E9E4"], // Muted Lilac
    ["#F72585", "#7209B7", "#3A0CA3", "#4361EE", "#4CC9F0"], // Vaporwave
    ["#0081A7", "#00AFB9", "#FDFCDC", "#FED9B7", "#F07167"], // Soft Beach
    ["#3D5A80", "#98C1D9", "#E0FBFC", "#EE6C4D", "#293241"], // Nordic
    ["#EDC4B3", "#E6B8A2", "#DEAB90", "#D69F7E", "#CD9777"], // Skin Tones
    ["#231942", "#5E548E", "#9F86C0", "#BE95C4", "#E0B1CB"], // Royal Purple
    ["#0D1B2A", "#1B263B", "#415A77", "#778DA9", "#E0E1DD"], // Deep Space
    ["#10002B", "#240046", "#3C096C", "#5A189A", "#7B2CBF"], // Ultraviolet
    ["#463F3A", "#8A817C", "#BCB8B1", "#F4F3EE", "#E0AFA0"], // Stone & Clay
    ["#582F0E", "#7F4F24", "#936639", "#A68A64", "#B6AD90"], // Coffee Shop
    ["#D9ED92", "#B5E48C", "#99D98C", "#76C893", "#52B69A"], // Green Gradient
    ["#FF9F1C", "#FFBF69", "#FFFFFF", "#CBF3F0", "#2EC4B6"]  // Citrus Splash
];

// 2. Helper: Generates a random Hex color
const getRandomHex = () => {
  const letters = "0123456789ABCDEF";
  let color = "#";
  for (let i = 0; i < 6; i++) {
    color += letters[Math.floor(Math.random() * 16)];
  }
  return color;
};

// 3. Helper: Generates a pleasing random palette with 3-6 colors
const generateRandomPalette = () => {
  const length = Math.floor(Math.random() * 4) + 3; // Random length 3 to 6
  const palette = [];
  for (let i = 0; i < length; i++) {
    palette.push(getRandomHex());
  }
  return palette;
};

// 4. Generate the remaining palettes to reach exactly 1000
const totalNeeded = 1000;
const generatedPalettes = Array.from(
  { length: totalNeeded - curatedPalettes.length },
  generateRandomPalette
);

// 5. Final Export Variable (Using the name 'PALETTES' to match your app)
const PALETTES = [...curatedPalettes, ...generatedPalettes];


const getTodayString = () => new Date().toISOString().split('T')[0];
const getRandomItem = (arr) => arr[Math.floor(Math.random() * arr.length)];


// --- MASTER DRAWING HELPERS (Math for New Shapes) ---

// Helper: Draws regular polygons (5 sides, 6 sides, 8 sides, etc.)
const drawPolygon = (ctx, x, y, size, sides) => {
    ctx.moveTo(x + size * Math.cos(0), y + size * Math.sin(0));
    for (let i = 1; i <= sides; i++) {
        ctx.lineTo(x + size * Math.cos(i * 2 * Math.PI / sides), y + size * Math.sin(i * 2 * Math.PI / sides));
    }
    ctx.closePath();
};

// Helper: Draws stars with any number of points
const drawStar = (ctx, x, y, size, points, inset = 0.5) => {
    ctx.moveTo(x, y - size);
    for (let i = 0; i < points * 2; i++) {
        const radius = i % 2 === 0 ? size : size * inset;
        const angle = (i * Math.PI) / points;
        ctx.lineTo(x + Math.sin(angle) * radius, y - Math.cos(angle) * radius);
    }
    ctx.closePath();
};

// --- MAIN DRAW FUNCTION (Consolidated) ---
const drawShape = (ctx, x, y, size, shape) => {
    ctx.beginPath();
    switch (shape) {
        // --- 1. Basic Geometry ---
        case 'line':      ctx.moveTo(x, y - size); ctx.lineTo(x, y + size); break;
        case 'cross':     ctx.moveTo(x - size, y); ctx.lineTo(x + size, y); ctx.moveTo(x, y - size); ctx.lineTo(x, y + size); break;
        case 'plus':      ctx.moveTo(x - size, y); ctx.lineTo(x + size, y); ctx.moveTo(x, y - size); ctx.lineTo(x, y + size); break; // Thick cross
        case 'x-mark':    ctx.moveTo(x - size, y - size); ctx.lineTo(x + size, y + size); ctx.moveTo(x + size, y - size); ctx.lineTo(x - size, y + size); break;
        case 'ring':      ctx.arc(x, y, size, 0, Math.PI * 2); break;
        case 'semi-circle': ctx.arc(x, y, size, Math.PI, 0); break;
        case 'moon':      ctx.arc(x, y, size, 1, 5); ctx.bezierCurveTo(x-size*0.5, y, x-size*0.5, y-size, x+size*0.8, y-size*0.8); break;
        
        // --- 2. Advanced Custom Paths ---
        case 'heart':
             ctx.moveTo(x, y);
             ctx.bezierCurveTo(x, y-3, x-5, y-15, x-25, y-15);
             ctx.bezierCurveTo(x-55, y-15, x-55, y+22.5, x-55, y+22.5);
             ctx.bezierCurveTo(x-55, y+40, x-35, y+62, x, y+80);
             ctx.bezierCurveTo(x+35, y+62, x+55, y+40, x+55, y+22.5);
             ctx.bezierCurveTo(x+55, y+22.5, x+55, y-15, x+25, y-15);
             ctx.bezierCurveTo(x+5, y-15, x, y-3, x, y);
             break;
        case 'zigzag':
             ctx.moveTo(x-size, y-size); 
             ctx.lineTo(x-size/2, y+size); ctx.lineTo(x, y-size); 
             ctx.lineTo(x+size/2, y+size); ctx.lineTo(x+size, y-size);
             break;
        case 'wave':
             ctx.moveTo(x-size, y);
             ctx.quadraticCurveTo(x-size/2, y-size, x, y);
             ctx.quadraticCurveTo(x+size/2, y+size, x+size, y);
             break;
        case 'sparkle':
             drawStar(ctx, x, y, size, 4, 0.15); // Thin 4-point star
             break;

        // --- 3. The Math Automations (Efficiency!) ---
        case 'triangle':  drawPolygon(ctx, x, y, size, 3); break;
        case 'square':    ctx.rect(x - size, y - size, size * 2, size * 2); break;
        case 'diamond':   drawPolygon(ctx, x, y, size, 4); break; // Actually a rotated square, but polygon works
        case 'pentagon':  drawPolygon(ctx, x, y, size, 5); break;
        case 'hexagon':   drawPolygon(ctx, x, y, size, 6); break;
        case 'heptagon':  drawPolygon(ctx, x, y, size, 7); break;
        case 'octagon':   drawPolygon(ctx, x, y, size, 8); break;
        case 'nonagon':   drawPolygon(ctx, x, y, size, 9); break;
        case 'decagon':   drawPolygon(ctx, x, y, size, 10); break;
        case 'dodecagon': drawPolygon(ctx, x, y, size, 12); break;

        // --- 4. Star Variations ---
        case 'star':      drawStar(ctx, x, y, size, 5, 0.5); break; // Default 5-point
        case 'star-4':    drawStar(ctx, x, y, size, 4, 0.5); break;
        case 'star-5':    drawStar(ctx, x, y, size, 5, 0.5); break;
        case 'star-6':    drawStar(ctx, x, y, size, 6, 0.5); break; // David star style
        case 'star-7':    drawStar(ctx, x, y, size, 7, 0.5); break;
        case 'star-8':    drawStar(ctx, x, y, size, 8, 0.5); break;
        case 'star-9':    drawStar(ctx, x, y, size, 9, 0.6); break;
        case 'star-10':   drawStar(ctx, x, y, size, 10, 0.5); break;
        case 'burst-12':  drawStar(ctx, x, y, size, 12, 0.4); break; // Sharp burst
        case 'burst-20':  drawStar(ctx, x, y, size, 20, 0.5); break; // Shallow burst

        // Default to circle
        case 'circle':
        default:
             ctx.arc(x, y, size, 0, Math.PI * 2);
    }
    
    // Choose Stroke or Fill based on shape type
    if (['line', 'cross', 'plus', 'x-mark', 'ring', 'zigzag', 'wave'].includes(shape)) {
        ctx.stroke();
    } else {
        ctx.fill();
    }
};

// --- Components ---

// 1. CBT / Clarity View
const ClarityView = ({ user, dateStr }: { user: User | null, dateStr: string }) => {
  const [step, setStep] = useState(0);
  const [situation, setSituation] = useState('');
  const [emotion, setEmotion] = useState({ name: '', intensity: 5 });
  const [thought, setThought] = useState('');
  const [selectedDistortions, setSelectedDistortions] = useState<string[]>([]);
  const [reframe, setReframe] = useState('');
  const [actionPlan, setActionPlan] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [history, setHistory] = useState<any[]>([]);
  const [teaching, setTeaching] = useState(CBT_TEACHINGS[0]);
  
  // Interactive Tool State
  const [dailyToolResponse, setDailyToolResponse] = useState('');
  const [isToolSaved, setIsToolSaved] = useState(false);
  const [toolFeedback, setToolFeedback] = useState(''); // New Therapist feedback
  const [isFeedbackLoading, setIsFeedbackLoading] = useState(false);
  
  // New: Ability to manually cycle tools
  const [toolIndex, setToolIndex] = useState(0);
  
  // Initialize with a random tool based on date, but allow manual override
  useEffect(() => {
    const dateHash = dateStr.split('').reduce((a,b)=>a+b.charCodeAt(0),0);
    setToolIndex(dateHash % CBT_TEACHINGS.length);
  }, [dateStr]);
  
  useEffect(() => {
    setTeaching(CBT_TEACHINGS[toolIndex]);
  }, [toolIndex]);

  useEffect(() => {
    if (!user || !db) return;
    
    const unsub = onSnapshot(doc(db, 'artifacts', appId, 'users', user.uid, 'journal', dateStr), (doc) => {
        if (doc.exists()) {
            const data = doc.data();
            if (data.cbtEntries) setHistory(data.cbtEntries);
            if (data.dailyToolResponse) {
                setDailyToolResponse(data.dailyToolResponse);
                setIsToolSaved(true);
            }
            if (data.toolFeedback) setToolFeedback(data.toolFeedback);
        } else {
            setHistory([]);
            setDailyToolResponse('');
            setIsToolSaved(false);
            setToolFeedback('');
        }
    });
    return () => unsub();
  }, [user, dateStr]);

  const cycleTool = () => {
      setToolIndex((prev) => (prev + 1) % CBT_TEACHINGS.length);
      // Reset tool response state when manually changing tools (optional, or could persist per tool if extended)
      setDailyToolResponse('');
      setIsToolSaved(false);
      setToolFeedback('');
  };

  const toggleDistortion = (id: string) => {
    setSelectedDistortions(prev => prev.includes(id) ? prev.filter(d => d !== id) : [...prev, id]);
  };

  const saveDailyTool = async () => {
    if (!user || !db || !dailyToolResponse.trim()) return;
    try {
        await updateDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'journal', dateStr), { 
            dailyToolResponse, 
            dailyToolTitle: teaching.title 
        });
        setIsToolSaved(true);
    } catch (e) {
        await setDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'journal', dateStr), { 
            date: dateStr, 
            dailyToolResponse, 
            dailyToolTitle: teaching.title,
            updatedAt: Timestamp.now() 
        }, { merge: true });
        setIsToolSaved(true);
    }
  };

  const handleTherapistCheckIn = async (e: React.MouseEvent) => {
      e.preventDefault(); 
      if (!dailyToolResponse.trim()) return;
      setIsFeedbackLoading(true);
      const prompt = `The user is practicing a CBT tool called "${teaching.title}". Description: "${teaching.desc}" Practice Question: "${teaching.question}" User's Answer: "${dailyToolResponse}". Please provide brief, supportive, therapist-like feedback (max 3 sentences).`;
      const result = await callGemini(prompt, "You are a warm, wise CBT therapist.");
      setToolFeedback(result);
      if (user && db) {
          await updateDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'journal', dateStr), { toolFeedback: result });
      }
      setIsFeedbackLoading(false);
  };

  const handleAiReframe = async () => {
    setIsAiLoading(true);
    const distortions = CBT_DISTORTIONS.filter(d => selectedDistortions.includes(d.id)).map(d => d.label).join(', ');
    const prompt = `I am doing a CBT thought record. Situation: "${situation}" Emotion: ${emotion.name} (Intensity: ${emotion.intensity}/10) Negative Thought: "${thought}" Identified Distortions: ${distortions} Please provide: 1. A Balanced Reframe. 2. An Action Plan (one small behavioral experiment). Format: REFRAME: [text] ACTION: [text]`;
    const result = await callGemini(prompt, "You are an expert CBT therapist. Be empathetic, logical, and concise.");
    if (result.includes("ACTION:")) {
        const parts = result.split("ACTION:");
        setReframe(parts[0].replace("REFRAME:", "").trim());
        setActionPlan(parts[1].trim());
    } else {
        setReframe(result);
        setActionPlan("Take a deep breath and observe this thought passing like a cloud.");
    }
    setIsAiLoading(false);
  };

  const saveEntry = async () => {
    if (!user || !db) return;
    const entry = { id: Date.now().toString(), timestamp: new Date().toISOString(), situation, emotion, thought, selectedDistortions, reframe, actionPlan };
    try {
      await updateDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'journal', dateStr), { cbtEntries: arrayUnion(entry) });
      setStep(0); setSituation(''); setEmotion({ name: '', intensity: 5 }); setThought(''); setSelectedDistortions([]); setReframe(''); setActionPlan('');
    } catch (e) {
      await setDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'journal', dateStr), { date: dateStr, cbtEntries: [entry], updatedAt: Timestamp.now() }, { merge: true });
      setStep(0);
    }
  };

  const renderStep = () => {
    switch(step) {
      case 0: 
        const IconComponent = typeof teaching.icon === 'string' ? (ICON_MAP[teaching.icon] || Sparkles) : teaching.icon;
        return (
          <div className="flex flex-col space-y-6 animate-in fade-in duration-500">
            {/* Header with Title and CBT Label */}
            <div className="flex justify-between items-center px-2">
                <h3 className="text-xl font-light text-white">Cognitive Behavioral Therapy</h3>
            </div>

            <div className="bg-gradient-to-br from-indigo-900/40 to-gray-900 border border-indigo-500/20 rounded-2xl p-6 shadow-lg shadow-black/20">
               <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                      <div className="p-2 bg-indigo-500/20 text-indigo-300 rounded-lg">{IconComponent && <IconComponent className="w-6 h-6" />}</div>
                      <div><h3 className="text-xs font-bold text-indigo-400 uppercase tracking-widest">Daily Mind Tool</h3><h2 className="text-xl font-medium text-white">{teaching.title}</h2></div>
                  </div>
                  <button onClick={cycleTool} className="p-2 hover:bg-white/10 rounded-full transition-colors text-indigo-300" title="Next Tool">
                      <RefreshCw className="w-4 h-4" />
                  </button>
               </div>
               <p className="text-gray-300 mb-6 leading-relaxed border-l-2 border-indigo-500/30 pl-4">{teaching.desc}</p>
               <div className="space-y-3 mb-6 bg-black/20 p-4 rounded-xl">{teaching.list.map((item, i) => (<div key={i} className="flex items-start gap-3"><div className="w-1.5 h-1.5 rounded-full bg-indigo-400 mt-2 flex-shrink-0" /><p className="text-sm text-gray-300">{item}</p></div>))}</div>
               {teaching.interactive && (
                   <div className="mt-4 pt-4 border-t border-indigo-500/20">
                       <p className="text-sm text-white font-medium mb-2 flex items-center gap-2"><PenTool className="w-3 h-3" /> Practice:</p>
                       <p className="text-xs text-gray-400 mb-3 italic">{teaching.question}</p>
                       <div className="flex flex-col gap-3">
                           <textarea value={dailyToolResponse} onChange={(e) => setDailyToolResponse(e.target.value)} placeholder="Your answer..." className="w-full h-32 bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 text-sm text-white focus:border-indigo-500 outline-none resize-none leading-relaxed" />
                           <div className="flex justify-between items-center">
                             <button onClick={handleTherapistCheckIn} disabled={!dailyToolResponse.trim() || isFeedbackLoading} className="text-xs flex items-center gap-2 text-indigo-300 hover:text-white transition-colors" type="button">
                                 {isFeedbackLoading ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />} Therapist Check-in
                             </button>
                             <button onClick={saveDailyTool} disabled={!dailyToolResponse.trim()} className="bg-indigo-500 text-white px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider hover:bg-indigo-400 disabled:opacity-50 transition-colors">
                                 {isToolSaved ? 'Saved' : 'Save'}
                             </button>
                           </div>
                           {toolFeedback && (<div className="mt-4 bg-indigo-900/30 border border-indigo-500/30 rounded-xl p-4 animate-in fade-in"><div className="flex items-center gap-2 text-indigo-300 text-xs font-bold uppercase mb-2"><Sparkles className="w-3 h-3" /> Therapist Feedback</div><p className="text-sm text-indigo-100/90 leading-relaxed italic">{toolFeedback}</p></div>)}
                       </div>
                   </div>
               )}
            </div>
            <div className="flex flex-col gap-4">
               <div className="flex items-center justify-between text-xs text-gray-500 px-2 uppercase tracking-widest"><span>Deep Work</span></div>
               <button onClick={() => setStep(1)} className="group w-full p-4 bg-gray-900/50 hover:bg-gray-800 border border-gray-800 hover:border-gray-700 rounded-xl transition-all flex items-center justify-between">
                 <div className="flex items-center gap-4"><div className="w-10 h-10 rounded-full bg-gray-800 group-hover:bg-gray-700 flex items-center justify-center"><Cloud className="w-5 h-5 text-gray-400 group-hover:text-indigo-400 transition-colors" /></div><div className="text-left"><span className="block text-white font-medium">Start Thought Record</span><span className="text-xs text-gray-500">Untangle a specific situation</span></div></div><ChevronRight className="w-5 h-5 text-gray-600 group-hover:text-white" />
               </button>
            </div>
            {history.length > 0 && (
                <div className="mt-8 w-full text-left">
                    <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-4">Today's Clarity Sessions</h3>
                    <div className="space-y-3">{history.map(h => (<div key={h.id} className="bg-gray-900/50 border border-gray-800 p-4 rounded-xl"><div className="flex justify-between mb-2"><span className="text-xs text-indigo-400 font-medium">{new Date(h.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span><span className="text-xs text-gray-500">{h.selectedDistortions.length} Distortions</span></div><p className="text-gray-300 text-sm line-clamp-2 italic">"{h.thought}"</p></div>))}</div>
                </div>
            )}
          </div>
        );
      case 1:
        return (
          <div className="space-y-8 animate-in fade-in slide-in-from-right-8 duration-300">
            <div><label className="block text-indigo-300 text-sm font-medium mb-2 uppercase tracking-wide">The Situation</label><input value={situation} onChange={e => setSituation(e.target.value)} placeholder="What happened?" className="w-full bg-gray-900 border border-gray-700 rounded-xl p-4 text-white focus:ring-1 focus:ring-indigo-500 outline-none" /></div>
            <div><label className="block text-indigo-300 text-sm font-medium mb-2 uppercase tracking-wide">The Emotion</label><input value={emotion.name} onChange={e => setEmotion({...emotion, name: e.target.value})} placeholder="What are you feeling?" className="w-full bg-gray-900 border border-gray-700 rounded-xl p-4 text-white focus:ring-1 focus:ring-indigo-500 outline-none mb-4" /><div className="flex items-center gap-4"><span className="text-xs text-gray-500 w-12">Intensity</span><input type="range" min="1" max="10" value={emotion.intensity} onChange={e => setEmotion({...emotion, intensity: parseInt(e.target.value)})} className="flex-1 h-2 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-indigo-500" /><span className="text-xs font-bold text-indigo-400 w-6 text-right">{emotion.intensity}</span></div></div>
            <div className="flex justify-between pt-8"><button onClick={() => setStep(0)} className="text-gray-500 hover:text-white px-4">Cancel</button><button onClick={() => setStep(2)} disabled={!situation || !emotion.name} className="px-6 py-2 bg-white text-black rounded-lg font-medium hover:bg-gray-200 disabled:opacity-50 flex items-center gap-2">Next <ArrowRight className="w-4 h-4" /></button></div>
          </div>
        );
      case 2:
        return (
          <div className="space-y-8 animate-in fade-in slide-in-from-right-8 duration-300">
            <div><label className="block text-rose-300 text-sm font-medium mb-2 uppercase tracking-wide">Automatic Negative Thought</label><textarea value={thought} onChange={e => setThought(e.target.value)} placeholder="What specific thought is troubling you?" className="w-full h-40 bg-gray-900 border border-gray-700 rounded-xl p-4 text-white focus:ring-1 focus:ring-rose-500 outline-none resize-none" /></div>
            <div className="flex justify-between pt-8"><button onClick={() => setStep(1)} className="text-gray-500 hover:text-white px-4">Back</button><button onClick={() => setStep(3)} disabled={!thought} className="px-6 py-2 bg-white text-black rounded-lg font-medium hover:bg-gray-200 disabled:opacity-50 flex items-center gap-2">Analyze <ArrowRight className="w-4 h-4" /></button></div>
          </div>
        );
      case 3:
        return (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-8 duration-300 h-full flex flex-col">
            <div><label className="block text-amber-300 text-sm font-medium mb-4 uppercase tracking-wide">Identify Mind Traps</label><div className="grid grid-cols-1 md:grid-cols-2 gap-3 overflow-y-auto max-h-[50vh] pr-2">{CBT_DISTORTIONS.map(d => (<button key={d.id} onClick={() => toggleDistortion(d.id)} className={`text-left p-4 rounded-xl border transition-all ${selectedDistortions.includes(d.id) ? 'bg-amber-900/30 border-amber-500/50 text-amber-100' : 'bg-gray-900 border-gray-800 text-gray-400 hover:border-gray-600'}`}><div className="flex justify-between items-center mb-1"><span className="font-bold text-sm">{d.label}</span>{selectedDistortions.includes(d.id) && <CheckCircle className="w-4 h-4 text-amber-400" />}</div><p className="text-xs opacity-70 leading-relaxed">{d.desc}</p></button>))}</div></div>
            <div className="flex justify-between pt-4 mt-auto"><button onClick={() => setStep(2)} className="text-gray-500 hover:text-white px-4">Back</button><button onClick={() => setStep(4)} className="px-6 py-2 bg-white text-black rounded-lg font-medium hover:bg-gray-200 flex items-center gap-2">Reframe <ArrowRight className="w-4 h-4" /></button></div>
          </div>
        );
      case 4:
        return (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-8 duration-300">
            <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-4 mb-4"><p className="text-xs text-rose-400 font-bold uppercase mb-1">Old Thought</p><p className="text-gray-300 text-sm italic">"{thought}"</p></div>
            <div><div className="flex justify-between items-center mb-2"><label className="block text-teal-300 text-sm font-medium uppercase tracking-wide">Balanced Reframe</label><button onClick={handleAiReframe} disabled={isAiLoading} type="button" className="text-xs flex items-center gap-1 text-teal-400 hover:text-teal-200 transition-colors">{isAiLoading ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />} Ask AI</button></div>
                <textarea value={reframe} onChange={e => setReframe(e.target.value)} placeholder="What is a truer, more helpful way to see this?" className="w-full h-32 bg-gray-900 border border-gray-700 rounded-xl p-4 text-white focus:ring-1 focus:ring-teal-500 outline-none resize-none leading-relaxed" />
            </div>
            <div><label className="block text-indigo-300 text-sm font-medium mb-2 uppercase tracking-wide">Action Plan</label><textarea value={actionPlan} onChange={e => setActionPlan(e.target.value)} placeholder="One small action I can take..." className="w-full h-20 bg-gray-900 border border-gray-700 rounded-xl p-4 text-white focus:ring-1 focus:ring-indigo-500 outline-none resize-none leading-relaxed" /></div>
            <div className="flex justify-between pt-4"><button onClick={() => setStep(3)} className="text-gray-500 hover:text-white px-4">Back</button><button onClick={saveEntry} disabled={!reframe} className="px-6 py-2 bg-teal-500 text-black rounded-lg font-medium hover:bg-teal-400 disabled:opacity-50 flex items-center gap-2 shadow-lg shadow-teal-500/20">Save Clarity</button></div>
          </div>
        );
    }
  };

  return <div className="max-w-2xl mx-auto pb-48 px-6 pt-10">{step > 0 && (<div className="flex items-center gap-2 mb-8"><div className={`h-1 flex-1 rounded-full transition-all duration-500 ${step >= 1 ? 'bg-indigo-500' : 'bg-gray-800'}`} /><div className={`h-1 flex-1 rounded-full transition-all duration-500 ${step >= 2 ? 'bg-rose-500' : 'bg-gray-800'}`} /><div className={`h-1 flex-1 rounded-full transition-all duration-500 ${step >= 3 ? 'bg-amber-500' : 'bg-gray-800'}`} /><div className={`h-1 flex-1 rounded-full transition-all duration-500 ${step >= 4 ? 'bg-teal-500' : 'bg-gray-800'}`} /></div>)}{renderStep()}</div>;
};

// breathe component

// ==========================================
// SECTION: COMPONENT SETUP & STATE
// ==========================================
const BreathVisual = ({ user, dateStr, isActiveTab, theme }: { user: User | null, dateStr: string, isActiveTab: boolean, theme: string }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // -- UI & Session State --
  const [selectedPatternId, setSelectedPatternId] = useState('box');
  const [active, setActive] = useState(false); 
  const [timerDuration, setTimerDuration] = useState(300); 
  const [timeLeft, setTimeLeft] = useState(300);
  const [dailyMinutes, setDailyMinutes] = useState(0); 
  const [instruction, setInstruction] = useState("Ready");
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [muted, setMuted] = useState(false);
  const [sessionStartTime, setSessionStartTime] = useState<number | null>(null);

  // -- INTERNAL SAFETY DEFAULTS --
  // These prevent crashes if constants or database keys are missing from the main file scope
  const safeGetRandomItem = (arr: any[]) => (arr && arr.length > 0 ? arr[Math.floor(Math.random() * arr.length)] : null);
  
  const DEFAULT_PALETTES = [['#38bdf8', '#818cf8', '#c084fc'], ['#2dd4bf', '#34d399', '#a7f3d0']];
  const safePalettes = typeof PALETTES !== 'undefined' ? PALETTES : DEFAULT_PALETTES;
  
  const DEFAULT_SHAPES = ['circle', 'star-4w', 'star-5w', 'triangle'];
  const safeShapes = typeof PARTICLES_SHAPES !== 'undefined' ? PARTICLES_SHAPES : DEFAULT_SHAPES;

  const DEFAULT_BG = ['void', 'stars', 'orbit'];
  const safeBgStyles = typeof BG_STYLES !== 'undefined' ? BG_STYLES : DEFAULT_BG;

  const DEFAULT_PATTERNS = [
      { id: 'box', name: 'Box', description: '4-4-4-4', inhale: 4, holdIn: 4, exhale: 4, holdOut: 4 },
      { id: 'relax', name: 'Relax', description: '4-7-8', inhale: 4, holdIn: 7, exhale: 8, holdOut: 0 }
  ];
  const safePatterns = typeof BREATH_PATTERNS !== 'undefined' ? BREATH_PATTERNS : DEFAULT_PATTERNS;

  // -- Visual Settings --
  const [currentPalette, setCurrentPalette] = useState(safePalettes[0]);
  const [currentShape, setCurrentShape] = useState('circle');
  const [currentBg, setCurrentBg] = useState('void');
  const [currentSymmetry, setCurrentSymmetry] = useState(6); 
  const [particleCount, setParticleCount] = useState(400); 
  
  const [layer2Shape, setLayer2Shape] = useState('star-4w'); 
  const [layer3Shape, setLayer3Shape] = useState('circle'); 
  const [is3DEnabled, setIs3DEnabled] = useState(false);

  // -- Physics Refs --
  const mousePos = useRef({ x: 0, y: 0 });
  const ripples = useRef<{ x: number, y: number, r: number, alpha: number }[]>([]);
  const phantomStrength = useRef(0);

  // LOGGING: Check if component mounts
  useEffect(() => { console.log("✅ BreathVisual Mounted"); }, []);

  // -- Database Logic (SAFEGUARDED) --
  useEffect(() => {
    // FIX: Check if database vars exist before trying to use them
    if (!user || typeof db === 'undefined' || typeof appId === 'undefined' || typeof doc === 'undefined' || typeof getDoc === 'undefined') {
        console.warn("⚠️ Database unavailable or appId missing. Skipping loadStats.");
        return;
    }
    const loadStats = async () => {
      try {
        const docRef = doc(db, 'artifacts', appId, 'users', user.uid, 'journal', dateStr);
        const snap = await getDoc(docRef);
        if (snap.exists() && snap.data().breathMinutes) setDailyMinutes(snap.data().breathMinutes);
        else setDailyMinutes(0);
      } catch (e) { console.error("Load Stats Error (Safe to ignore):", e); }
    };
    loadStats();
  }, [user, dateStr]);

  const saveTime = async () => {
      // FIX: Check if database vars exist
      if (!sessionStartTime || !user || typeof db === 'undefined' || typeof appId === 'undefined' || typeof setDoc === 'undefined' || typeof increment === 'undefined' || typeof Timestamp === 'undefined') {
          console.warn("⚠️ Database unavailable. Skipping saveTime.");
          return;
      }
      const elapsedSeconds = (Date.now() - sessionStartTime) / 1000;
      if (elapsedSeconds < 5) return;
      const minutesToAdd = Math.ceil(elapsedSeconds / 60);
      setSessionStartTime(null);
      try {
          const docRef = doc(db, 'artifacts', appId, 'users', user.uid, 'journal', dateStr);
          await setDoc(docRef, { breathMinutes: increment(minutesToAdd), updatedAt: Timestamp.now(), date: dateStr }, { merge: true });
          setDailyMinutes(prev => prev + minutesToAdd);
      } catch(e) { console.error("Save breath error", e); }
  };

  // ==========================================
  // SECTION: AUDIO & TIMER LOGIC (SAFEGUARDED)
  // ==========================================
  // FIX: Safe wrapper for getAudioEngine to prevent crashes
  const safeGetAudioEngine = () => {
      if (typeof getAudioEngine !== 'undefined') return getAudioEngine();
      return null;
  };

  useEffect(() => {
      if (active) { setSessionStartTime(Date.now()); } else { saveTime(); }
      return () => { if (active) saveTime(); }; 
  }, [active]);

  useEffect(() => {
     // Removed isActiveTab check
  }, [isActiveTab]);

  useEffect(() => { 
      const ae = safeGetAudioEngine(); 
      if(ae) ae.toggleMute(muted); 
  }, [muted]);

  useEffect(() => {
    let interval: any;
    if (active && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft((prev) => prev - 1);
        const ae = safeGetAudioEngine();
        if(ae) ae.playHeartbeat(); 
      }, 1000);
    } else if (timeLeft === 0 && active) {
      setActive(false);
      const ae = safeGetAudioEngine();
      if(ae) ae.setBreathIntensity(0, 'Idle');
      setInstruction("Session Complete");
    }
    return () => clearInterval(interval);
  }, [active, timeLeft]);

  // -- Randomizer (SAFEGUARDED) --
  const randomizeColor = () => setCurrentPalette(safeGetRandomItem(safePalettes) || safePalettes[0]);
  
  const randomizeAll = () => {
      setCurrentPalette(safeGetRandomItem(safePalettes) || safePalettes[0]);
      setCurrentShape(safeGetRandomItem(safeShapes) || 'circle');
      setCurrentBg(safeGetRandomItem(safeBgStyles) || 'void');
      
      const symOptions = [1, 3, 4, 5, 6, 8, 10, 12];
      setCurrentSymmetry(safeGetRandomItem(symOptions));

      const countOptions = [200, 250, 300]; 
      setParticleCount(safeGetRandomItem(countOptions));

      setLayer2Shape(safeGetRandomItem(safeShapes) || 'star-4w');
      setLayer3Shape(safeGetRandomItem(safeShapes) || 'circle'); 
  };

  // FIX: Safe pattern lookup
  const pattern = safePatterns.find(p => p.id === selectedPatternId) || safePatterns[0];
  const totalCycle = pattern.inhale + pattern.holdIn + pattern.exhale + pattern.holdOut;
  const prevPhase = useRef(""); 

  // -- Main Animation Loop --
  useEffect(() => {
    if (!canvasRef.current) return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let startTime = Date.now();
    let frameCount = 0;
    
    // Initialize Particles
    let particles: any[] = [];
    for (let i = 0; i < particleCount; i++) {
      particles.push({
        angle: Math.random() * Math.PI * 2,
        radius: Math.random() * 1400,
        speed: 0.1 + Math.random() * 0.5,
        size: 0.1 + Math.random() * 1.0, 
        color: currentPalette[Math.floor(Math.random() * currentPalette.length)],
        offset: Math.random() * 100
      });
    }

    let layer2Particles: any[] = [];
    for (let i = 0; i < particleCount; i++) { 
      layer2Particles.push({
        angle: Math.random() * Math.PI * 2,
        radius: 150 + Math.random() * 200,
        speed: 0.5 + Math.random() * 0.5, 
        size: 0.5 + Math.random() * 0.1, 
        color: currentPalette[Math.floor(Math.random() * currentPalette.length)],
        offset: Math.random() * 5000
      });
    }

    let layer3Particles: any[] = [];
    for (let i = 0; i < particleCount; i++) { 
      layer3Particles.push({
        angle: Math.random() * Math.PI * 2,
        radius: 280 + Math.random() * 300,
        speed: 0.2 + Math.random() * 0.4, 
        size: 0.6 + Math.random() * 0.4, 
        color: currentPalette[Math.floor(Math.random() * currentPalette.length)],
        offset: Math.random() * 8000
      });
    }

    let layer4Particles: any[] = [];
    if (is3DEnabled) {
        for(let i=0; i<400; i++) {
            layer4Particles.push({
                x: (Math.random() - 0.5) * canvas.width * 4,
                y: (Math.random() - 0.5) * canvas.height * 4,
                z: Math.random() * 2000, 
                size: Math.random() * 2 + 1,
                color: currentPalette[Math.floor(Math.random() * currentPalette.length)]
            });
        }
    }

    const handleMouseMove = (e: MouseEvent) => {
        const rect = canvas.getBoundingClientRect();
        mousePos.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };
    const handleMouseDown = () => { 
        ripples.current.push({ x: mousePos.current.x, y: mousePos.current.y, r: 0, alpha: 2 });
    };
    
    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mousedown', handleMouseDown);

    // --- EMBEDDED DRAW HELPERS (Prevents crashes if missing) ---
    const drawPolygon = (ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, sides: number) => {
        if (sides < 3) return;
        ctx.beginPath();
        ctx.moveTo(x + radius * Math.cos(0), y + radius * Math.sin(0));
        for (let i = 1; i <= sides; i++) {
            ctx.lineTo(x + radius * Math.cos(i * 2 * Math.PI / sides), y + radius * Math.sin(i * 2 * Math.PI / sides));
        }
        ctx.closePath();
        ctx.fill();
    };

    const drawStar = (ctx: CanvasRenderingContext2D, cx: number, cy: number, outerRadius: number, innerRadius: number, spikes: number) => {
        let rot = Math.PI / 2 * 3;
        let x = cx;
        let y = cy;
        let step = Math.PI / spikes;
        ctx.beginPath();
        ctx.moveTo(cx, cy - outerRadius);
        for (let i = 0; i < spikes; i++) {
            x = cx + Math.cos(rot) * outerRadius;
            y = cy + Math.sin(rot) * outerRadius;
            ctx.lineTo(x, y);
            rot += step;
            x = cx + Math.cos(rot) * innerRadius;
            y = cy + Math.sin(rot) * innerRadius;
            ctx.lineTo(x, y);
            rot += step;
        }
        ctx.lineTo(cx, cy - outerRadius);
        ctx.closePath();
        ctx.fill();
    };

    const localDrawShape = (ctx: CanvasRenderingContext2D, x: number, y: number, size: number, shape: string) => {
        // Safe internal draw function
        switch (shape) {
            case 'circle': ctx.beginPath(); ctx.arc(x, y, size, 0, Math.PI * 2); ctx.fill(); break;
            case 'square': ctx.fillRect(x - size, y - size, size * 2, size * 2); break;
            case 'triangle': drawPolygon(ctx, x, y, size * 1.2, 3); break;
            case 'pentagon': drawPolygon(ctx, x, y, size, 5); break;
            case 'hexagon': drawPolygon(ctx, x, y, size, 6); break;
            case 'star-4w': drawStar(ctx, x, y, size * 1.5, size * 0.5, 4); break;
            case 'star-5w': drawStar(ctx, x, y, size * 1.5, size * 0.6, 5); break;
            default: ctx.beginPath(); ctx.arc(x, y, size, 0, Math.PI * 2); ctx.fill();
        }
    };

    // Render Frame
    const render = () => {
      try {
        // --- DEBUGGING LOGS ---
        if (frameCount === 0) {
            console.log("✅ Animation Loop Started");
            console.log("Canvas Size:", canvas.width, "x", canvas.height);
        }
        frameCount++;

        if (!active) startTime = Date.now();
        const now = Date.now();
        const elapsed = (now - startTime) / 1000;
        const cycleTime = elapsed % totalCycle;
        
        let phaseName = "";
        let expansion = 0;
        
        if (cycleTime < pattern.inhale) {
            phaseName = "Inhale";
            const t = cycleTime / pattern.inhale;
            expansion = -(Math.cos(Math.PI * t) - 1) / 2;
        } else if (cycleTime < pattern.inhale + pattern.holdIn) {
            phaseName = "Hold";
            expansion = 1;
        } else if (cycleTime < pattern.inhale + pattern.holdIn + pattern.exhale) {
            phaseName = "Exhale";
            const t = (cycleTime - pattern.inhale - pattern.holdIn) / pattern.exhale;
            expansion = 1 - (-(Math.cos(Math.PI * t) - 1) / 2);
        } else {
            phaseName = "Hold";
            expansion = 0;
        }

        if (active) {
            setInstruction(phaseName);
            const ae = safeGetAudioEngine();
            if (ae) {
                if (prevPhase.current !== phaseName) {
                    ae.playPhaseCue();
                    prevPhase.current = phaseName;
                }
                ae.setBreathIntensity(expansion, phaseName);
            }
        } else {
            const ae = safeGetAudioEngine();
            if(ae) ae.setBreathIntensity(0, 'Idle');
        }

        // Canvas Resizing
        const parent = canvas.parentElement;
        if (parent && (canvas.width !== parent.clientWidth || canvas.height !== parent.clientHeight)) {
            canvas.width = parent.clientWidth;
            canvas.height = parent.clientHeight;
        }
        
        const w = canvas.width;
        const h = canvas.height;
        const cx = w / 2;
        const cy = h / 2;

        ctx.fillStyle = theme === 'light' ? 'rgba(255, 255, 255, 0.25)' : 'rgba(5, 5, 7, 0.25)';
        ctx.fillRect(0, 0, w, h);

        if (currentBg === 'stars') {
            for(let i=0; i<100; i++) {
                ctx.fillStyle = theme === 'light' ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.2)';
                ctx.beginPath();
                const x = (i * 137 + elapsed * 5) % w;
                const y = (i * 243 + elapsed * 2) % h;
                ctx.arc(x, y, Math.random() * 1.5, 0, Math.PI*2);
                ctx.fill();
            }
        }

        ripples.current.forEach((r, idx) => {
            r.r += 6.0; 
            r.alpha -= 0.02;
            if (r.alpha <= 0) ripples.current.splice(idx, 1);
        });

        // Phantom Cursor
        const orbitSpeed = elapsed * 0.8; 
        const orbitRadius = 350; 
        const phantomX = cx + Math.cos(orbitSpeed) * orbitRadius;
        const phantomY = cy + Math.sin(orbitSpeed) * orbitRadius;

        let targetStrength = 0;
        if (active && (phaseName === 'Inhale' || phaseName === 'Exhale')) {
            targetStrength = 1.0;
        }
        
        phantomStrength.current += (targetStrength - phantomStrength.current) * 0.05;
        const breathScale = 0.5 + (expansion * 0.15); 
        
        ctx.save();
        ctx.translate(cx, cy);
        if (currentBg === 'orbit') ctx.rotate(elapsed * 0.1); 

        // Draw Layers
        if (is3DEnabled) {
            ctx.save();
            const paraX = (mousePos.current.x - cx) * 0.5;
            const paraY = (mousePos.current.y - cy) * 0.5;
            ctx.translate(-paraX, -paraY);
            layer4Particles.forEach(p => {
                let speed = 5;
                if (active) {
                    if (phaseName === 'Inhale') p.z -= speed * 3;
                    else if (phaseName === 'Exhale') p.z += speed * 3;
                    else p.z -= speed; 
                } else { p.z -= speed; }
                if (p.z < 0) p.z = 2000;
                if (p.z > 2000) p.z = 0;
                const focalLength = 300;
                const scale = focalLength / (focalLength + p.z);
                const px = p.x * scale;
                const py = p.y * scale;
                ctx.beginPath();
                ctx.arc(px, py, p.size * scale, 0, Math.PI*2);
                ctx.fillStyle = p.color; 
                ctx.globalAlpha = scale; 
                ctx.fill();
            });
            ctx.restore();
        }

        ctx.globalCompositeOperation = 'lighter';
        const symmetries = currentSymmetry;

        // Using safe internal draw
        particles.forEach((p, i) => {
            let currentRadius = p.radius * breathScale + (expansion * 60);
            let currentAngle = p.angle + (expansion * Math.PI * 0.5) + (elapsed * 0.10 * p.speed); 
            
            ripples.current.forEach(r => {
                const dist = Math.sqrt(Math.pow((cx + Math.cos(currentAngle) * currentRadius) - r.x, 2) + Math.pow((cy + Math.sin(currentAngle) * currentRadius) - r.y, 2));
                if (dist < r.r + 50 && dist > r.r - 50) currentRadius += 100 * r.alpha;
            });
            const px = cx + Math.cos(currentAngle) * currentRadius;
            const py = cy + Math.sin(currentAngle) * currentRadius;
            const dx = px - mousePos.current.x;
            const dy = py - mousePos.current.y;
            const distToMouse = Math.sqrt(dx*dx + dy*dy);
            if (distToMouse < 150) currentRadius += (150 - distToMouse) * 0.8;
            const x = Math.cos(currentAngle) * currentRadius;
            const y = Math.sin(currentAngle) * currentRadius;
            const drawSize = Math.min(p.size * (1 + expansion), 4); 

            for(let s=0; s<symmetries; s++) {
                ctx.save();
                ctx.rotate((Math.PI * 2 / symmetries) * s);
                if (currentRadius < 50) {
                    const opacity = (1 - (currentRadius / 100)) * 0.5;
                    ctx.beginPath();
                    ctx.moveTo(0,0);
                    ctx.lineTo(x, y);
                    ctx.strokeStyle = p.color;
                    ctx.globalAlpha = opacity;
                    ctx.lineWidth = 1.1;
                    ctx.stroke();
                }
                ctx.fillStyle = p.color;
                ctx.globalAlpha = 0.8;
                localDrawShape(ctx, x, y, drawSize, currentShape);
                ctx.restore();
            }
        });

        const l2Points: {x:number, y:number, color:string}[] = [];
        layer2Particles.forEach((p, i) => {
            let currentRadius = p.radius * breathScale + (expansion * 30);
            let currentAngle = p.angle - (expansion * Math.PI * 0.5) - (elapsed * 0.10 * p.speed); 
            ripples.current.forEach(r => {
                const dist = Math.sqrt(Math.pow((cx + Math.cos(currentAngle) * currentRadius) - r.x, 2) + Math.pow((cy + Math.sin(currentAngle) * currentRadius) - r.y, 2));
                if (dist < r.r + 50 && dist > r.r - 50) currentRadius += 100 * r.alpha;
            });
            const px = cx + Math.cos(currentAngle) * currentRadius;
            const py = cy + Math.sin(currentAngle) * currentRadius;
            const dx = px - mousePos.current.x;
            const dy = py - mousePos.current.y;
            const distToMouse = Math.sqrt(dx*dx + dy*dy);
            if (distToMouse < 150) currentRadius += (150 - distToMouse) * 0.8;
            const x = Math.cos(currentAngle) * currentRadius;
            const y = Math.sin(currentAngle) * currentRadius;
            const drawSize = Math.min(p.size * (1 + expansion), 4);
            l2Points.push({x, y, color: p.color});
            for(let s=0; s<symmetries; s++) {
                ctx.save();
                ctx.rotate((Math.PI * 2 / symmetries) * s);
                ctx.fillStyle = p.color;
                ctx.globalAlpha = 0.6; 
                localDrawShape(ctx, x, y, drawSize, layer2Shape); 
                ctx.restore();
            }
        });

        for(let s=3; s<symmetries; s++) {
            ctx.save();
            ctx.rotate((Math.PI * 2 / symmetries) * s);
            for (let i = 0; i < l2Points.length; i++) {
                const p1 = l2Points[i];
                for (let j = 1; j <= 2; j++) {
                    const p2 = l2Points[(i + j) % l2Points.length];
                    const dx = p1.x - p2.x;
                    const dy = p1.y - p2.y;
                    const dist = Math.sqrt(dx*dx + dy*dy);
                    if (dist < 100) {
                        ctx.beginPath();
                        ctx.moveTo(p1.x, p1.y);
                        ctx.lineTo(p2.x, p2.y);
                        ctx.strokeStyle = p1.color;
                        ctx.globalAlpha = (1 - dist/50) * 0.3;
                        ctx.lineWidth = 0.5;
                        ctx.stroke();
                    }
                }
            }
            ctx.restore();
        }

        const l3Points: {x:number, y:number, color:string}[] = [];
        layer3Particles.forEach((p, i) => {
            let currentRadius = p.radius * breathScale + (expansion * 40);
            let currentAngle = p.angle + (expansion * Math.PI * 0.2) + (elapsed * 0.05 * p.speed); 
            ripples.current.forEach(r => {
                const dist = Math.sqrt(Math.pow((cx + Math.cos(currentAngle) * currentRadius) - r.x, 2) + Math.pow((cy + Math.sin(currentAngle) * currentRadius) - r.y, 2));
                if (dist < r.r + 50 && dist > r.r - 50) currentRadius += 100 * r.alpha;
            });
            const px = cx + Math.cos(currentAngle) * currentRadius;
            const py = cy + Math.sin(currentAngle) * currentRadius;
            const dx = px - mousePos.current.x;
            const dy = py - mousePos.current.y;
            const distToMouse = Math.sqrt(dx*dx + dy*dy);
            if (distToMouse < 150) currentRadius += (150 - distToMouse) * 0.8;
            const pdx = px - phantomX; 
            const pdy = py - phantomY;
            const distToPhantom = Math.sqrt(pdx*pdx + pdy*pdy);
            if (distToPhantom < 120) {
                currentRadius += (120 - distToPhantom) * 0.5 * phantomStrength.current;
            }
            const x = Math.cos(currentAngle) * currentRadius;
            const y = Math.sin(currentAngle) * currentRadius;
            const drawSize = Math.min(p.size * (1 + expansion), 5); 
            l3Points.push({x, y, color: p.color});
            for(let s=0; s<symmetries; s++) {
                ctx.save();
                ctx.rotate((Math.PI * 2 / symmetries) * s);
                ctx.fillStyle = p.color;
                ctx.globalAlpha = 0.5; 
                localDrawShape(ctx, x, y, drawSize, layer3Shape); 
                ctx.restore();
            }
        });

        for(let s=0; s<symmetries; s+=2) { 
            ctx.save();
            ctx.rotate((Math.PI * 2 / symmetries) * s);
            for (let i = 0; i < l3Points.length; i++) {
                const p1 = l3Points[i];
                for (let j = 1; j <= 2; j++) {
                    const p2 = l3Points[(i + j) % l3Points.length];
                    const dx = p1.x - p2.x;
                    const dy = p1.y - p2.y;
                    const dist = Math.sqrt(dx*dx + dy*dy);
                    if (dist < 300) {
                        ctx.beginPath();
                        ctx.moveTo(p1.x, p1.y);
                        ctx.lineTo(p2.x, p2.y);
                        ctx.strokeStyle = p1.color;
                        ctx.globalAlpha = (1 - dist/100) * 0.2; 
                        ctx.lineWidth = 0.5;
                        ctx.stroke();
                    }
                }
            }
            ctx.restore();
        }

        const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, 60 * breathScale);
        const centerColor = currentPalette[1] || 'white';
        gradient.addColorStop(0, centerColor); 
        gradient.addColorStop(0.4, centerColor); 
        gradient.addColorStop(1, 'rgba(0,0,0,0)'); 
        ctx.fillStyle = gradient;
        ctx.globalAlpha = 0.8;
        ctx.beginPath();
        ctx.arc(0,0, 60 * breathScale, 0, Math.PI*2); 
        ctx.fill();
        ctx.fillStyle = 'white';
        ctx.globalAlpha = 0.9;
        ctx.beginPath();
        ctx.arc(0,0, 5, 0, Math.PI*2);
        ctx.fill();
        ctx.restore();

        const ringRadius = Math.min(w, h) * 0.35;
        ctx.beginPath();
        ctx.arc(cx, cy, ringRadius, 0, Math.PI * 2);
        ctx.strokeStyle = theme === 'light' ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.05)';
        ctx.lineWidth = 5;
        ctx.stroke();

        if (active) {
            const progressAngle = (cycleTime / totalCycle) * Math.PI * 2 - Math.PI / 2;
            ctx.beginPath();
            ctx.arc(cx, cy, ringRadius, -Math.PI/2, progressAngle);
            ctx.strokeStyle = currentPalette[0] || 'teal';
            ctx.lineWidth = 6;
            ctx.stroke();
            const orbX = cx + Math.cos(progressAngle) * ringRadius;
            const orbY = cy + Math.sin(progressAngle) * ringRadius;
            ctx.save();
            ctx.shadowBlur = 55;
            ctx.shadowColor = currentPalette[0] || 'teal';
            ctx.fillStyle = 'blue';
            ctx.beginPath();
            ctx.arc(orbX, orbY, 6, 0, Math.PI*2);
            ctx.fill();
            ctx.restore();
        }
      } catch (err) { console.error("Animation Loop Error", err); }
      animationFrameId = requestAnimationFrame(render);
    };

    render();
    return () => {
        canvas.removeEventListener('mousemove', handleMouseMove);
        canvas.removeEventListener('mousedown', handleMouseDown);
        cancelAnimationFrame(animationFrameId);
    };
  }, [active, selectedPatternId, pattern, isActiveTab, currentPalette, currentShape, currentBg, theme, currentSymmetry, particleCount, layer2Shape, layer3Shape, is3DEnabled]);

  // -- Render UI --
  const handleToggle = () => {
    if (!active) {
      if (timeLeft === 0) setTimeLeft(timerDuration);
      const ae = safeGetAudioEngine();
      if(ae) ae.init();
    }
    setActive(!active);
    setIsMenuOpen(false);
  };
  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  // FIX: Using 100dvh for better mobile height support
  return (
    <div className={`relative w-full min-h-[100dvh] flex flex-col ${theme === 'light' ? 'bg-gray-100' : 'bg-[#050507]'}`}>
      <div className="absolute top-0 left-0 right-0 z-20 p-6 pt-4 bg-gradient-to-b from-black/20 to-transparent flex justify-between items-start pointer-events-none">
        <div className="flex-1 max-w-md mx-auto pointer-events-auto flex justify-between">
           <div className={`text-xs font-mono tracking-widest ${theme === 'light' ? 'text-gray-900' : 'text-gray-400'}`}>
               GOAL: {dailyMinutes}/15m
           </div>
           <div className="flex gap-2">
               <button onClick={randomizeColor} className="p-2 bg-black/20 rounded-full hover:bg-black/40 transition-colors" title="Shuffle Colors"><Palette className={`w-4 h-4 ${theme === 'light' ? 'text-gray-800' : 'text-gray-300'}`} /></button>
               <button onClick={randomizeAll} className="p-2 bg-black/20 rounded-full hover:bg-black/40 transition-colors" title="Surprise Me"><Shuffle className="w-4 h-4 text-teal-400" /></button>
           </div>
        </div>
      </div>
      <div className="relative flex-1 overflow-hidden">
        <canvas ref={canvasRef} className="absolute inset-0 z-0 touch-none" />
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-10 mix-blend-screen">
          <h2 className={`text-5xl md:text-7xl font-thin tracking-widest transition-all duration-500 ${theme === 'light' ? 'text-gray-900' : 'text-white'}`}>
             {instruction}
          </h2>
          {active && <p className={`mt-4 text-xl font-mono tracking-widest ${theme === 'light' ? 'text-gray-900' : 'text-gray-400'}`}>{formatTime(timeLeft)}</p>}
        </div>
        <div className="absolute bottom-28 right-6 z-30 flex gap-4 pointer-events-auto items-center">
             <button onClick={() => setIsMenuOpen(!isMenuOpen)} className={`w-12 h-12 rounded-full backdrop-blur border flex items-center justify-center transition-all ${isMenuOpen ? 'bg-teal-500 text-black border-teal-400' : 'bg-black/40 border-white/10 text-gray-400 hover:text-white'}`}>
                 <Sliders className="w-5 h-5" />
             </button>
             <button onClick={handleToggle} className={`w-16 h-16 rounded-full flex items-center justify-center shadow-xl transition-all ${active ? 'bg-gray-800 text-red-400 hover:bg-gray-700' : 'bg-teal-500 text-black hover:bg-teal-400 hover:scale-105'}`}>
               {active ? <Pause className="w-8 h-8 fill-current" /> : <Play className="w-8 h-8 fill-current translate-x-0.5" />}
             </button>
        </div>
      </div>
      <div className={`absolute bottom-0 left-0 right-0 z-20 backdrop-blur-xl border-t p-6 pb-24 rounded-t-3xl transition-transform duration-500 ${isMenuOpen ? 'translate-y-0' : 'translate-y-full'} ${theme === 'light' ? 'bg-white/90 border-gray-200' : 'bg-black/90 border-white/10'}`}>
         <div className="max-w-md mx-auto space-y-6">
            <div className="flex justify-between items-center mb-2">
                <h3 className={`font-medium ${theme === 'light' ? 'text-gray-900' : 'text-white'}`}>Breath Settings</h3>
                <button onClick={() => setIsMenuOpen(false)}><XCircle className="w-6 h-6 text-gray-500" /></button>
            </div>
            <div className="flex gap-2">
                <button onClick={() => setMuted(!muted)} className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-xl border ${theme === 'light' ? 'bg-gray-100 border-gray-200' : 'bg-gray-900/50 border-gray-800'}`}>
                    {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                    <span className="text-xs uppercase tracking-widest">{muted ? "Muted" : "Sound On"}</span>
                </button>
                <button onClick={() => setIs3DEnabled(!is3DEnabled)} className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-xl border transition-all ${is3DEnabled ? 'bg-teal-500/20 border-teal-500 text-teal-400' : `${theme === 'light' ? 'bg-gray-100 border-gray-200' : 'bg-gray-900/50 border-gray-800'}`}`}>
                    <Box className="w-4 h-4" />
                    <span className="text-xs uppercase tracking-widest">{is3DEnabled ? "3D ON" : "3D OFF"}</span>
                </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
               {safePatterns.map(p => (
                 <button key={p.id} onClick={() => { setActive(false); setSelectedPatternId(p.id); }} className={`flex flex-col items-start p-3 rounded-xl border transition-all ${selectedPatternId === p.id ? 'bg-teal-500/10 border-teal-500 text-teal-600' : `border-transparent hover:bg-gray-100 ${theme === 'light' ? 'text-gray-600' : 'text-gray-400'}`}`}>
                   <span className="text-xs font-bold uppercase mb-1">{p.name}</span>
                   <span className="text-[10px] opacity-70">{p.description}</span>
                 </button>
               ))}
            </div>
            <div className="space-y-2">
               <label className="text-xs text-gray-500 uppercase tracking-widest">Duration</label>
               <div className={`flex items-center gap-2 rounded-lg p-1 border ${theme === 'light' ? 'bg-gray-100 border-gray-200' : 'bg-gray-900 border-gray-800'}`}>
                  {[60, 300, 600, 1200].map(t => (
                    <button key={t} onClick={() => { setTimerDuration(t); setTimeLeft(t); setActive(false); }} className={`flex-1 px-3 py-2 text-xs font-medium rounded-md transition-all ${timerDuration === t ? 'bg-gray-700 text-white' : 'text-gray-500 hover:text-gray-400'}`}>
                      {t/60}m
                    </button>
                  ))}
               </div>
            </div>
         </div>
      </div>
    </div>
  );
};

// 1. Integrated Vitals View (Self-Contained Version)
const VitalsView = ({ user, dateStr, onSave }: { user: any, dateStr: string, onSave: (data: any) => void }) => {
  const [session, setSession] = useState<'morning' | 'night'>('morning');

  // --- SAFE ICON DEFINITIONS (Prevents "ReferenceError" if not imported at top of file) ---
  const BaseIcon = (props: any) => <Activity {...props} />;
  const IconFlower = typeof Flower2 !== 'undefined' ? Flower2 : BaseIcon;
  const IconBrain = typeof Brain !== 'undefined' ? Brain : BaseIcon;
  const IconBattery = typeof Battery !== 'undefined' ? Battery : BaseIcon;
  const IconDumbbell = typeof Dumbbell !== 'undefined' ? Dumbbell : BaseIcon;
  const IconScale = typeof Scale !== 'undefined' ? Scale : BaseIcon;
  const IconPill = typeof Pill !== 'undefined' ? Pill : BaseIcon;
  const IconDroplet = typeof Droplet !== 'undefined' ? Droplet : BaseIcon;
  const IconCoffee = typeof Coffee !== 'undefined' ? Coffee : BaseIcon;
  const IconUtensils = typeof Utensils !== 'undefined' ? Utensils : BaseIcon;
  const IconUsers = typeof Users !== 'undefined' ? Users : BaseIcon;
  const IconMessage = typeof MessageCircle !== 'undefined' ? MessageCircle : BaseIcon;
  const IconPhone = typeof Phone !== 'undefined' ? Phone : BaseIcon;
  const IconVideo = typeof Video !== 'undefined' ? Video : BaseIcon;
  const IconAlert = typeof AlertCircle !== 'undefined' ? AlertCircle : BaseIcon;
  const IconShare = typeof Share2 !== 'undefined' ? Share2 : BaseIcon;

  const [data, setData] = useState<any>({
    morning: { 
        alignment: 5, practice: '', mood: 'Neutral', anticipatedStress: 30, 
        bedtime: '22:30', waketime: '06:30', meds: true, nutrition: '', 
        hydration: 0, caffeine: 0, social: [], symptoms: [], weight: '' 
    },
    night: { 
        alignment: 5, practice: '', mood: 'Neutral', actualStress: 30, 
        energy: 50, focus: 5, socialBattery: 50, movement: [], 
        meds: true, nutrition: '', hydration: 0, caffeine: 0, social: [], symptoms: [] 
    }
  });

  const [isSaving, setIsSaving] = useState(false);
  const [vitalsInsight, setVitalsInsight] = useState('');
  const [isVitalsLoading, setIsVitalsLoading] = useState(false);
  const [newActivity, setNewActivity] = useState({ name: '', duration: '' });
  const [newSocial, setNewSocial] = useState({ type: 'Meeting', note: '' });
  const [newSymptom, setNewSymptom] = useState('');

  useEffect(() => {
    if (!user || !db) return;
    const loadData = async () => {
      try {
        const docRef = doc(db, 'artifacts', appId, 'users', user.uid, 'journal', dateStr);
        const snap = await getDoc(docRef);
        if (snap.exists()) {
          const d = snap.data();
          setData({
            morning: {
                alignment: d.alignment ?? 5,
                practice: d.practice ?? '',
                mood: d.weather || d.mood || 'Neutral',
                anticipatedStress: d.stress ?? d.anticipatedStress ?? 30,
                bedtime: d.bedtime ?? '22:30',
                waketime: d.waketime ?? '06:30',
                meds: d.meds ?? true,
                nutrition: d.diet || d.nutrition || '',
                hydration: d.hydration ?? 0,
                caffeine: d.caffeine ?? 0,
                social: d.social ?? [],
                symptoms: d.bodyTension || d.symptoms || [],
                weight: d.weight || ''
            },
            night: d.nightVitals || {
                alignment: 5, practice: '', mood: 'Neutral', actualStress: 30, 
                energy: 50, focus: 5, socialBattery: 50, movement: [], 
                meds: true, nutrition: '', hydration: 0, caffeine: 0, social: [], symptoms: []
            }
          });
          if (d.vitalsInsight) setVitalsInsight(d.vitalsInsight);
        }
      } catch (err) { console.error("Vitals load error:", err); }
    };
    loadData();
  }, [user, dateStr]);

  const saveToFirebase = async (updatedData: any) => {
    if (!user || !db) return;
    setIsSaving(true);
    try {
      const docRef = doc(db, 'artifacts', appId, 'users', user.uid, 'journal', dateStr);
      const updatePayload = {
          alignment: updatedData.morning.alignment,
          practice: updatedData.morning.practice,
          weather: updatedData.morning.mood,
          stress: updatedData.morning.anticipatedStress,
          bedtime: updatedData.morning.bedtime,
          waketime: updatedData.morning.waketime,
          meds: updatedData.morning.meds,
          diet: updatedData.morning.nutrition,
          hydration: updatedData.morning.hydration,
          caffeine: updatedData.morning.caffeine,
          social: updatedData.morning.social,
          bodyTension: updatedData.morning.symptoms,
          weight: updatedData.morning.weight, // --- FIX: Added weight saving ---
          nightVitals: updatedData.night,
          vitalsInsight,
          updatedAt: Timestamp.now(),
          date: dateStr
      };
      await setDoc(docRef, updatePayload, { merge: true });
      onSave(updatePayload); 
    } catch (e) { console.error("Vitals save error:", e); }
    finally { setTimeout(() => setIsSaving(false), 800); }
  };

  const update = (field: string, val: any) => {
      const nextData = { ...data, [session]: { ...data[session], [field]: val } };
      setData(nextData);
      saveToFirebase(nextData);
  };
  
  const updateShared = (field: string, val: any) => {
      const nextData = {
          morning: { ...data.morning, [field]: val },
          night: { ...data.night, [field]: val }
      };
      setData(nextData);
      saveToFirebase(nextData);
  };

  const addToList = (field: string, item: any, resetFn: () => void) => {
      const currentList = data[session][field] || [];
      update(field, [...currentList, item]);
      resetFn();
  };

  const removeFromList = (field: string, index: number) => {
      const currentList = [...(data[session][field] || [])];
      currentList.splice(index, 1);
      update(field, currentList);
  };

  const handleAnalysis = async () => {
      setIsVitalsLoading(true);
      const prompt = `Session: ${session}. Data: ${JSON.stringify(data[session])}. Provide a holistic wellness insight.`;
      // @ts-ignore
      const result = await callGemini(prompt, "You are a wise wellness coach.");
      setVitalsInsight(result);
      setIsVitalsLoading(false);
      // Save insight immediately
      if(user && db) {
          await updateDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'journal', dateStr), { vitalsInsight: result });
      }
  };

  const renderSocialIcon = (type: string) => {
      switch(type) {
          case 'Call': return <IconPhone className="w-3 h-3" />;
          case 'Video': return <IconVideo className="w-3 h-3" />;
          case 'Meeting': return <IconUsers className="w-3 h-3" />;
          default: return <IconShare className="w-3 h-3" />;
      }
  };

  return (
    <div className="max-w-2xl mx-auto pb-32 px-6 pt-10 animate-in fade-in duration-500 font-sans text-gray-100">
        <div className="mb-8 flex justify-between items-center">
            <div>
                <h2 className="text-2xl font-light text-white mb-1 flex items-center gap-3">
                    <Activity className="w-6 h-6 text-rose-400" /> Vitals
                </h2>
                <p className="text-gray-500 text-sm">Check-in with your body.</p>
            </div>
            
            <div className="bg-gray-900 p-1 rounded-lg border border-gray-800 flex shadow-sm">
                <button onClick={() => setSession('morning')} className={`px-4 py-2 rounded-md text-xs font-medium transition-all flex items-center gap-2 ${session === 'morning' ? 'bg-rose-500/20 text-rose-300 shadow-inner' : 'text-gray-500 hover:text-white'}`}><Sun className="w-3 h-3" /> AM</button>
                <button onClick={() => setSession('night')} className={`px-4 py-2 rounded-md text-xs font-medium transition-all flex items-center gap-2 ${session === 'night' ? 'bg-indigo-500/20 text-indigo-300 shadow-inner' : 'text-gray-500 hover:text-white'}`}><Moon className="w-3 h-3" /> PM</button>
            </div>
        </div>

        <div className="space-y-8">
            <section className="bg-gray-900/40 rounded-2xl p-6 border border-gray-800 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1 h-full bg-purple-500/50" />
                <h3 className="text-xs font-medium text-purple-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                    <IconFlower className="w-3 h-3" /> Spiritual Foundation
                </h3>
                <div className="space-y-6">
                    <div>
                        <div className="flex justify-between mb-2">
                            <label className="text-sm text-gray-400">{session === 'morning' ? 'Current Alignment' : 'Daily Alignment'}</label>
                            <span className="text-xs text-purple-300 font-mono">{data[session].alignment}/10</span>
                        </div>
                        <input type="range" min="0" max="10" value={data[session].alignment} onChange={(e) => update('alignment', parseInt(e.target.value))} className="w-full h-1.5 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-purple-500" />
                    </div>
                    <textarea 
                        value={data[session].practice || ''} 
                        onChange={(e) => update('practice', (e.target as HTMLTextAreaElement).value)} 
                        placeholder={session === 'morning' ? "Morning Practice" : "Night Reflection"} 
                        className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-3 text-sm text-white focus:border-purple-500 outline-none h-24 resize-none" 
                    />
                </div>
            </section>

            <section className="bg-gray-900/40 rounded-2xl p-6 border border-gray-800 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1 h-full bg-sky-500/50" />
                <h3 className="text-xs font-medium text-sky-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                    <IconBrain className="w-3 h-3" /> Mental State
                </h3>
                <div className="space-y-6">
                    <div>
                        <label className="block text-xs text-gray-500 mb-3">Current Mood</label>
                        <div className="flex flex-wrap gap-2">
                            {['Calm', 'Focused', 'Anxious', 'Scattered', 'Low', 'High', 'Neutral'].map(m => (
                                <button key={m} onClick={() => update('mood', m)} className={`px-3 py-1.5 text-xs rounded-lg border transition-all ${data[session].mood === m ? 'bg-sky-500/20 border-sky-500 text-sky-300' : 'border-gray-700 text-gray-500 hover:text-white'}`}>{m}</button>
                            ))}
                        </div>
                    </div>
                    {session === 'night' && (
                        <div className="space-y-5 pt-2">
                            <div><div className="flex justify-between mb-2"><label className="text-sm text-gray-400 flex items-center gap-2"><IconBattery className="w-3 h-3" /> Social Battery</label><span className="text-xs text-green-300 font-mono">{data.night.socialBattery}%</span></div><input type="range" value={data.night.socialBattery} onChange={(e) => update('socialBattery', parseInt(e.target.value))} className="w-full h-1.5 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-green-500" /></div>
                        </div>
                    )}
                </div>
            </section>

            <section className="bg-gray-900/40 rounded-2xl p-6 border border-gray-800 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1 h-full bg-blue-500/50" />
                <h3 className="text-xs font-medium text-blue-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                    <IconUsers className="w-3 h-3" /> Connections & Community
                </h3>
                <div className="space-y-4">
                    <div className="space-y-2">
                        {data[session].social?.map((s: any, i: number) => (
                            <div key={i} className="flex justify-between items-center text-xs text-gray-300 bg-gray-900/80 px-3 py-2.5 rounded-lg border border-gray-800">
                                <div className="flex items-center gap-2">
                                    <span className="text-blue-400 p-1.5 bg-blue-500/10 rounded-md">{renderSocialIcon(s.type)}</span>
                                    <span className="font-semibold text-gray-200">{s.type}:</span>
                                    <span className="text-gray-400 italic">{s.note}</span>
                                </div>
                                <button onClick={() => removeFromList('social', i)} className="text-gray-600 hover:text-red-400 transition-colors p-1"><Trash2 className="w-3.5 h-3.5" /></button>
                            </div>
                        ))}
                    </div>
                    <div className="flex flex-col sm:flex-row gap-2 pt-2">
                        <select value={newSocial.type} onChange={e => setNewSocial({...newSocial, type: e.target.value})} className="bg-gray-800 border border-gray-700 rounded-lg px-2 py-2 text-xs text-white outline-none">
                            <option>Meeting</option><option>Call</option><option>Video</option><option>Social Event</option><option>Other</option>
                        </select>
                        <input placeholder="Note (e.g. AA Meeting)" value={newSocial.note} onChange={e => setNewSocial({...newSocial, note: e.target.value})} className="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-xs text-white focus:border-blue-500 outline-none" />
                        <button onClick={() => addToList('social', newSocial, () => setNewSocial({type: 'Meeting', note: ''}))} disabled={!newSocial.note} className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg transition-colors"><PlusCircle className="w-4 h-4" /></button>
                    </div>
                </div>
            </section>

            <section className="bg-gray-900/40 rounded-2xl p-6 border border-gray-800 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500/50" />
                <h3 className="text-xs font-medium text-emerald-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                    <IconDumbbell className="w-3 h-3" /> Physical Body
                </h3>
                
                <div className="space-y-6">
                    <div className="bg-emerald-950/20 p-4 rounded-xl border border-emerald-900/30">
                        <label className="text-[10px] text-emerald-400 font-bold uppercase tracking-widest block mb-3 flex items-center gap-2">
                            <IconAlert className="w-3 h-3" /> Body Awareness & Symptoms
                        </label>
                        <div className="flex flex-wrap gap-2 mb-3">
                            {data[session].symptoms?.map((s: string, i: number) => (
                                <div key={i} className="flex items-center gap-2 text-[10px] bg-emerald-900/40 border border-emerald-700/50 text-emerald-100 px-2.5 py-1 rounded-full">
                                    {s} <button onClick={() => removeFromList('symptoms', i)} className="text-emerald-500 hover:text-emerald-300"><Trash2 className="w-2.5 h-2.5" /></button>
                                </div>
                            ))}
                        </div>
                        <div className="flex gap-2">
                            <input placeholder="Add symptom (Headache...)" value={newSymptom} onChange={e => setNewSymptom(e.target.value)} onKeyPress={e => e.key === 'Enter' && newSymptom && addToList('symptoms', newSymptom, () => setNewSymptom(''))} className="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-[10px] text-white focus:border-emerald-500 outline-none" />
                            <button onClick={() => addToList('symptoms', newSymptom, () => setNewSymptom(''))} disabled={!newSymptom} className="bg-emerald-600 hover:bg-emerald-500 text-white px-3 rounded-lg flex items-center justify-center transition-colors"><PlusCircle className="w-4 h-4" /></button>
                        </div>
                    </div>

                    {session === 'morning' && (
                        <div className="grid grid-cols-2 gap-4">
                             <div><label className="text-xs text-gray-500 block mb-1">Bedtime</label><input type="time" value={data.morning.bedtime} onChange={(e) => update('bedtime', e.target.value)} className="w-full bg-gray-800 border border-gray-700 rounded-lg p-2 text-white text-sm outline-none" /></div>
                             <div><label className="text-xs text-gray-500 block mb-1">Wake Time</label><input type="time" value={data.morning.waketime} onChange={(e) => update('waketime', e.target.value)} className="w-full bg-gray-800 border border-gray-700 rounded-lg p-2 text-white text-sm outline-none" /></div>
                             <div className="col-span-2 relative"><input type="number" placeholder="Weight (lbs/kg)" value={data.morning.weight} onChange={(e) => update('weight', e.target.value)} className="w-full bg-gray-800 border border-gray-700 rounded-lg p-3 text-white text-sm outline-none" /><IconScale className="w-4 h-4 text-gray-500 absolute right-3 top-3.5" /></div>
                        </div>
                    )}

                    <div className="grid grid-cols-2 gap-4">
                         <div>
                             <div className="flex justify-between mb-3"><label className="text-xs text-gray-500 flex items-center gap-2"><IconDroplet className="w-3 h-3 text-sky-400" /> Hydration</label><span className="text-xs text-sky-300 font-mono">{data[session].hydration}</span></div>
                             <div className="flex gap-2 items-center"><button onClick={() => updateShared('hydration', Math.max(0, data[session].hydration - 1))} className="w-8 h-8 rounded-lg bg-gray-800 text-gray-400 flex items-center justify-center">-</button><div className="flex-1 flex gap-1 h-8 items-center bg-gray-900/50 rounded-lg px-2 border border-gray-800">{Array.from({length: Math.min(8, data[session].hydration)}).map((_,i) => <div key={i} className="flex-1 h-4 bg-sky-500 rounded-sm" />)}</div><button onClick={() => updateShared('hydration', data[session].hydration + 1)} className="w-8 h-8 rounded-lg bg-gray-800 text-gray-400 flex items-center justify-center">+</button></div>
                         </div>
                         <div>
                             <div className="flex justify-between mb-3"><label className="text-xs text-gray-500 flex items-center gap-2"><IconCoffee className="w-3 h-3 text-amber-600" /> Caffeine</label><span className="text-xs text-amber-500 font-mono">{data[session].caffeine || 0}</span></div>
                             <div className="flex gap-2 items-center"><button onClick={() => updateShared('caffeine', Math.max(0, (data[session].caffeine || 0) - 1))} className="w-8 h-8 rounded-lg bg-gray-800 text-gray-400 flex items-center justify-center">-</button><div className="flex-1 flex gap-1 h-8 items-center bg-gray-900/50 rounded-lg px-2 border border-gray-800">{Array.from({length: Math.min(5, data[session].caffeine || 0)}).map((_,i) => <div key={i} className="flex-1 h-4 bg-amber-700 rounded-sm" />)}</div><button onClick={() => updateShared('caffeine', (data[session].caffeine || 0) + 1)} className="w-8 h-8 rounded-lg bg-gray-800 text-gray-400 flex items-center justify-center">+</button></div>
                         </div>
                    </div>

                    <div><label className="text-xs text-gray-500 block mb-2 flex items-center gap-2"><IconUtensils className="w-3 h-3 text-orange-400" /> Nutrition Log</label><textarea value={data[session].nutrition} onChange={(e) => updateShared('nutrition', e.target.value)} placeholder="Log meals..." className="w-full h-24 bg-gray-900 border border-gray-700 rounded-xl p-3 text-xs text-white outline-none resize-none focus:border-orange-500 transition-colors" /></div>
                </div>
            </section>

            <div className="pt-4">
                <button onClick={handleAnalysis} disabled={isVitalsLoading} className="group w-full py-4 bg-gradient-to-r from-gray-800 to-gray-900 border border-gray-700 hover:border-gray-500 rounded-xl text-sm text-white font-medium transition-all flex items-center justify-center gap-2 shadow-lg">
                    {isVitalsLoading ? <RefreshCw className="w-4 h-4 animate-spin text-teal-400" /> : <Sparkles className="w-4 h-4 text-teal-400 group-hover:text-teal-300" />} {isVitalsLoading ? 'Analyzing Data...' : 'Analyze My Balance'}
                </button>
                {vitalsInsight && (<div className="mt-6 p-5 bg-gradient-to-br from-teal-900/20 to-gray-900 rounded-2xl border border-teal-500/20 animate-in slide-in-from-bottom-2 duration-500"><div className="flex items-center gap-2 mb-2 text-teal-400 text-xs font-bold uppercase tracking-widest"><Sparkles className="w-3 h-3" /> Insight</div><p className="text-sm text-gray-300 leading-relaxed font-serif italic">"{vitalsInsight}"</p></div>)}
            </div>
        </div>
        {isSaving && <div className="fixed bottom-24 right-6 bg-black/60 px-3 py-1.5 rounded-full border border-white/10 text-[10px] text-emerald-400 animate-pulse font-bold uppercase">Autosaving</div>}
    </div>
  );
};

// 3. Journal Entry Component
type Reflection = {
  id: string;
  prompt: string;
  text: string;
};

const JournalEntry = ({ user, dateStr, vitals }: { user: User | null, dateStr: string, vitals: any }) => {
  const [session, setSession] = useState<'morning' | 'night'>('morning');
  
  // Morning Fields
  const [intentions, setIntentions] = useState(['', '', '']);
  const [morningGratitudes, setMorningGratitudes] = useState(['', '', '']);
  const [dreams, setDreams] = useState('');
  const [morningFreeFlow, setMorningFreeFlow] = useState('');
  const [dreamAnalysis, setDreamAnalysis] = useState('');
  const [isDreamLoading, setIsDreamLoading] = useState(false);
  
  // New: Morning Affirmations
  const [affirmations, setAffirmations] = useState(['', '', '']);

  // Suggestion State
  const [isSuggesting, setIsSuggesting] = useState(false);

  // Night Fields
  const [highlight, setHighlight] = useState('');
  const [wins, setWins] = useState(['', '', '']);
  const [lettingGo, setLettingGo] = useState('');
  const [reflections, setReflections] = useState<Reflection[]>([
    { id: 'init', prompt: PROMPTS[0], text: '' }
  ]);
  const [eveningFreeFlow, setEveningFreeFlow] = useState('');
  
  // New: Learning Log
  const [learningLog, setLearningLog] = useState<any[]>([]); // {id, type, title, progress, takeaway}
  const [isAddingResource, setIsAddingResource] = useState(false);
  const [newResource, setNewResource] = useState({ type: 'Book', title: '', progress: '', takeaway: '' });

  // Shared/System
  const [quote, setQuote] = useState(QUOTES[0]);
  const [isSaving, setIsSaving] = useState(false);
  const [aiInsight, setAiInsight] = useState<string | null>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [isAudioLoading, setIsAudioLoading] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [showShareToast, setShowShareToast] = useState(false);

  // Progress Calculation
  const progress = React.useMemo(() => {
    let score = 0;
    // Morning (40%)
    if (intentions.some(i => i.length > 0)) score += 5;
    if (affirmations.some(a => a.length > 0)) score += 5; // New
    if (morningGratitudes.some(g => g.length > 0)) score += 10;
    if (morningFreeFlow.length > 10 || dreams.length > 10) score += 20;
    
    // Night (40%)
    if (highlight.length > 0) score += 10;
    if (wins.some(w => w.length > 0)) score += 10;
    if (reflections.some(r => r.text.length > 10) || eveningFreeFlow.length > 10) score += 5;
    if (learningLog.length > 0) score += 5; // New
    if (lettingGo.length > 5) score += 10;
    
    // Vitals (20%)
    if (vitals && vitals.weather && vitals.sleep) score += 20;

    return Math.min(100, score);
  }, [vitals, intentions, affirmations, morningGratitudes, morningFreeFlow, dreams, highlight, wins, reflections, eveningFreeFlow, lettingGo, learningLog]);

  useEffect(() => {
    if (!user || !db) return;
    const dateHash = dateStr.split('').reduce((a,b)=>a+b.charCodeAt(0),0);
    const dailyQuote = QUOTES[dateHash % QUOTES.length];
    setQuote(dailyQuote);
    const loadDoc = async () => {
      try {
        const docRef = doc(db, 'artifacts', appId, 'users', user.uid, 'journal', dateStr);
        const snap = await getDoc(docRef);
        if (snap.exists()) {
          const data = snap.data();
          // Map data to fields
          if (data.intentions) setIntentions(data.intentions);
          if (data.affirmations) setAffirmations(data.affirmations); // New
          if (data.morningGratitudes) setMorningGratitudes(data.morningGratitudes); else if (data.gratitudes) setMorningGratitudes(data.gratitudes); // Legacy fallback
          if (data.dreams) setDreams(data.dreams);
          if (data.morningFreeFlow) setMorningFreeFlow(data.morningFreeFlow); else if (data.freeFlow) setMorningFreeFlow(data.freeFlow); // Legacy fallback
          if (data.dreamAnalysis) setDreamAnalysis(data.dreamAnalysis);

          if (data.highlight) setHighlight(data.highlight);
          if (data.wins) setWins(data.wins);
          if (data.lettingGo) setLettingGo(data.lettingGo);
          if (data.eveningFreeFlow) setEveningFreeFlow(data.eveningFreeFlow);
          if (data.learningLog) setLearningLog(data.learningLog); // New
          if (data.aiInsight) setAiInsight(data.aiInsight);
          if (data.reflections && Array.isArray(data.reflections)) setReflections(data.reflections);
          else if (data.journal) setReflections([{ id: 'legacy', prompt: data.prompt || PROMPTS[0], text: data.journal }]);
          else setReflections([{ id: Date.now().toString(), prompt: PROMPTS[0], text: '' }]);
        } else {
          // Reset
          setIntentions(['', '', '']); setAffirmations(['', '', '']); setMorningGratitudes(['', '', '']); setDreams(''); setMorningFreeFlow(''); setDreamAnalysis('');
          setHighlight(''); setWins(['', '', '']); setLettingGo(''); setEveningFreeFlow(''); setAiInsight(null); setLearningLog([]);
          setReflections([{ id: Date.now().toString(), prompt: getRandomItem(PROMPTS), text: '' }]);
        }
      } catch (e) { console.error("Error loading doc:", e); }
    };
    loadDoc();
  }, [user, dateStr]);

  // Debounced Save
  useEffect(() => {
    if (!user || !db) return;
    const saveData = async () => {
      setIsSaving(true);
      try {
        const docRef = doc(db, 'artifacts', appId, 'users', user.uid, 'journal', dateStr);
        await setDoc(docRef, {
          date: dateStr, 
          intentions, affirmations, morningGratitudes, dreams, morningFreeFlow, dreamAnalysis, // Morning
          highlight, wins, lettingGo, eveningFreeFlow, reflections, learningLog, aiInsight, // Night
          quote, updatedAt: Timestamp.now()
        }, { merge: true });
      } catch (e) { console.error("Save failed:", e); } finally { setIsSaving(false); }
    };
    const timer = setTimeout(saveData, 2000);
    return () => clearTimeout(timer);
  }, [intentions, affirmations, morningGratitudes, dreams, morningFreeFlow, dreamAnalysis, highlight, wins, lettingGo, eveningFreeFlow, reflections, learningLog, aiInsight, quote, user, dateStr]);

  // Handlers
  const handleIntentionChange = (idx: number, val: string) => { const newArr = [...intentions]; newArr[idx] = val; setIntentions(newArr); };
  const handleAffirmationChange = (idx: number, val: string) => { const newArr = [...affirmations]; newArr[idx] = val; setAffirmations(newArr); }; // New
  const handleMorningGratitudeChange = (idx: number, val: string) => { const newArr = [...morningGratitudes]; newArr[idx] = val; setMorningGratitudes(newArr); };
  const handleWinChange = (idx: number, val: string) => { const newArr = [...wins]; newArr[idx] = val; setWins(newArr); };
  const handleReflectionChange = (id: string, text: string) => { setReflections(prev => prev.map(r => r.id === id ? { ...r, text } : r)); };
  const cyclePrompt = (id: string) => { const newPrompt = getRandomItem(PROMPTS); setReflections(prev => prev.map(r => r.id === id ? { ...r, prompt: newPrompt } : r)); };
  const addReflectionBlock = () => {
    const usedPrompts = new Set(reflections.map(r => r.prompt));
    const availablePrompts = PROMPTS.filter(p => !usedPrompts.has(p));
    const nextPrompt = availablePrompts.length > 0 ? getRandomItem(availablePrompts) : getRandomItem(PROMPTS);
    setReflections(prev => [...prev, { id: Date.now().toString(), prompt: nextPrompt, text: '' }]);
  };
  const removeReflectionBlock = (id: string) => { if (reflections.length > 1) setReflections(prev => prev.filter(r => r.id !== id)); };

  // Learning Log Handlers
  const handleAddResource = () => {
      if (newResource.title) {
          setLearningLog(prev => [...prev, { id: Date.now().toString(), ...newResource }]);
          setNewResource({ type: 'Book', title: '', progress: '', takeaway: '' });
          setIsAddingResource(false);
      }
  };
  const handleRemoveResource = (id: string) => {
      setLearningLog(prev => prev.filter(item => item.id !== id));
  };

  const handleShare = async () => {
    // Fetch latest complete data from DB (for breath mins, tools, etc not in local state)
    let breathMins = 0;
    let toolResponse = '';
    let currentVitals: any = vitals;
    
    if (user && db) {
        try {
            const docRef = doc(db, 'artifacts', appId, 'users', user.uid, 'journal', dateStr);
            const snap = await getDoc(docRef);
            if (snap.exists()) {
                const d = snap.data();
                breathMins = d.breathMinutes || 0;
                toolResponse = d.dailyToolResponse || '';
                // Fallback if vitals prop was empty, load from DB
                if (!currentVitals) {
                    currentVitals = { ...d };
                }
            }
        } catch (e) { console.error(e); }
    }

    const formattedDate = new Date(dateStr).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
    let shareText = `🌿 Mindfulness Journal • ${formattedDate}\n\n`;

    // --- FIX: Updated Vitals Sharing Logic ---
    const mood = currentVitals?.weather || currentVitals?.mood;
    const align = currentVitals?.alignment;
    const battery = currentVitals?.nightVitals?.socialBattery;
    const sleep = currentVitals?.waketime ? `Up at ${currentVitals.waketime}` : null;

    if (mood || align || battery) {
        shareText += `📊 Vitals\n`;
        if (mood) shareText += `• Mood: ${mood}\n`;
        if (align) shareText += `• Alignment: ${align}/10\n`;
        if (battery) shareText += `• Social Battery: ${battery}%\n`;
        if (sleep) shareText += `• Sleep: ${sleep}\n`;
        if (currentVitals?.social?.length) shareText += `• Connections: ${currentVitals.social.length}\n`;
        shareText += `\n`;
    }

    // Intentions
    const validIntentions = intentions.filter(i => i.trim());
    if (validIntentions.length > 0) {
        shareText += `☀️ Intentions\n${validIntentions.map(i => `• ${i}`).join('\n')}\n\n`;
    }
    
    // Affirmations
    const validAffirmations = affirmations.filter(a => a.trim());
    if (validAffirmations.length > 0) {
        shareText += `✨ Affirmations\n${validAffirmations.map(a => `• ${a}`).join('\n')}\n\n`;
    }

    // Gratitude
    const validGratitudes = morningGratitudes.filter(g => g.trim());
    if (validGratitudes.length > 0) {
        shareText += `🙏 Gratitude\n${validGratitudes.map(g => `• ${g}`).join('\n')}\n\n`;
    }

    // Daily Tool
    if (toolResponse) {
        shareText += `🛠️ Daily Tool\n"${toolResponse}"\n\n`;
    }

    // Dreams
    if (dreams.trim()) {
        shareText += `💭 Dreams\n${dreams}\n\n`;
    }

    // Morning Pages
    if (morningFreeFlow.trim()) {
        shareText += `📝 Morning Pages\n${morningFreeFlow}\n\n`;
    }

    // Highlight
    if (highlight.trim()) {
        shareText += `🌟 Highlight\n${highlight}\n\n`;
    }

    // Wins
    const validWins = wins.filter(w => w.trim());
    if (validWins.length > 0) {
        shareText += `🏆 Small Wins\n${validWins.map(w => `• ${w}`).join('\n')}\n\n`;
    }
    
    // Learning Log
    if (learningLog.length > 0) {
        shareText += `📚 Learning Log\n`;
        learningLog.forEach(item => {
            shareText += `• ${item.type}: ${item.title} (${item.progress})\n  "${item.takeaway}"\n`;
        });
        shareText += `\n`;
    }

    // Reflections
    const validReflections = reflections.filter(r => r.text.trim());
    if (validReflections.length > 0) {
        shareText += `🧘 Reflections\n`;
        validReflections.forEach(r => {
            shareText += `Q: ${r.prompt}\nA: ${r.text}\n`;
        });
        shareText += `\n`;
    }

    // Letting Go
    if (lettingGo.trim()) {
        shareText += `🍂 Letting Go\n${lettingGo}\n\n`;
    }
    
    // Evening Pages
    if (eveningFreeFlow.trim()) {
        shareText += `🌙 Evening Thoughts\n${eveningFreeFlow}\n\n`;
    }

    // Stats
    if (breathMins > 0) {
        shareText += `🌬️ Breathwork: ${breathMins} minutes\n`;
    }
    
    shareText += `\n"${quote.text}"\n— ${quote.author}`;

    if (navigator.share) { 
        try { await navigator.share({ title: 'My Mindfulness Journal', text: shareText }); } catch (err) { console.log('Share canceled'); } 
    } else { 
        try { await navigator.clipboard.writeText(shareText); setShowShareToast(true); setTimeout(() => setShowShareToast(false), 3000); } catch (err) { console.error('Failed to copy'); } 
    }
  };

  const handleGenerateInsight = async () => {
    setIsAiLoading(true); setAudioUrl(null);
    const reflectionText = reflections.map(r => `Prompt: ${r.prompt}\nAnswer: ${r.text}`).join('\n');
    const context = `
      Morning Intentions: ${intentions.join(', ')}
      Dreams: ${dreams}
      Morning Gratitude: ${morningGratitudes.join(', ')}
      Daily Highlight: ${highlight}
      Small Wins: ${wins.join(', ')}
      Letting Go: ${lettingGo}
      Evening Reflections: ${reflectionText}
    `;
    const systemPrompt = "You are a compassionate, poetic, and wise mindfulness companion. Analyze the user's daily journal entry. Offer ONE deep, philosophical insight or perspective shift. Keep it under 100 words.";
    const userPrompt = `Here is my journal entry for today. Please offer me a reflection.\n${context}`;
    const result = await callGemini(userPrompt, systemPrompt);
    setAiInsight(result); setIsAiLoading(false);
  };

  const handleDreamAnalysis = async () => {
    if (!dreams) return;
    setIsDreamLoading(true);
    const systemPrompt = "You are a wise dream interpreter focusing on psychological symbolism and emotional growth. Be gentle, insightful, and concise (under 100 words).";
    const userPrompt = `Interpret this dream: "${dreams}"`;
    const result = await callGemini(userPrompt, systemPrompt);
    setDreamAnalysis(result);
    setIsDreamLoading(false);
  }
  
  const handlePlayAudio = async () => {
    if (!aiInsight) return;
    if (isPlaying && audioRef.current) { audioRef.current.pause(); setIsPlaying(false); return; }
    if (audioUrl && audioRef.current) { audioRef.current.play(); setIsPlaying(true); return; }
    setIsAudioLoading(true);
    const base64Audio = await callGeminiTTS(aiInsight);
    setIsAudioLoading(false);
    if (base64Audio) {
      const audio = new Audio("data:audio/wav;base64," + base64Audio);
      audioRef.current = audio;
      audio.onended = () => setIsPlaying(false);
      audio.play(); setIsPlaying(true); setAudioUrl("loaded");
    }
  };

  const handleSuggestIntentions = async () => {
      setIsSuggesting(true);
      const mood = vitals?.weather || 'neutral';
      const sleep = vitals?.sleep || 'unknown';
      const energy = vitals?.energy || 50;
      
      const prompt = `Based on a mood of ${mood}, sleep quality of ${sleep}, and energy level of ${energy}%, suggest 3 short, simple, positive daily intentions (max 6 words each). Format: "Intention 1|Intention 2|Intention 3"`;
      
      const result = await callGemini(prompt, "You are a helpful mindfulness coach.");
      const suggested = result.split('|').map(s => s.trim().replace(/^"|"$/g, ''));
      
      if (suggested.length >= 3) {
          setIntentions([suggested[0], suggested[1], suggested[2]]);
      } else {
          setIntentions(["Be kind to myself", "Focus on one thing at a time", "Breathe deeply"]);
      }
      setIsSuggesting(false);
  };

  return (
    <div className="max-w-2xl mx-auto pb-32 px-6 animate-in fade-in duration-500 relative">
      <div className="absolute top-0 right-6 flex gap-2">
        <button onClick={handleShare} className="p-2 text-gray-500 hover:text-teal-400 transition-colors bg-gray-900/50 rounded-full border border-gray-800" title="Share Entry">
          {showShareToast ? <Copy className="w-5 h-5" /> : <Share2 className="w-5 h-5" />}
        </button>
      </div>

      <div className="mb-6 pt-2">
         <div className="flex justify-between items-end mb-2 text-xs font-medium tracking-widest text-gray-400 uppercase">
             <span>Daily Progress</span>
             <span className={`${progress === 100 ? 'text-teal-400' : 'text-gray-500'}`}>{progress}%</span>
          </div>
          <div className="h-1 w-full bg-gray-800 rounded-full overflow-hidden">
             <div className={`h-full transition-all duration-1000 ${progress === 100 ? 'bg-teal-400 shadow-[0_0_10px_rgba(45,212,191,0.5)]' : 'bg-gradient-to-r from-gray-600 to-gray-400'}`} style={{ width: `${progress}%` }} />
          </div>
       </div>
      
      {/* Session Toggle */}
      <div className="flex justify-center mb-8">
        <div className="bg-gray-900 p-1 rounded-xl border border-gray-800 inline-flex">
           <button 
             onClick={() => setSession('morning')}
             className={`px-6 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${session === 'morning' ? 'bg-gray-800 text-amber-200 shadow-sm' : 'text-gray-500 hover:text-gray-300'}`}
           >
             <Sun className="w-4 h-4" /> Morning
           </button>
           <button 
             onClick={() => setSession('night')}
             className={`px-6 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${session === 'night' ? 'bg-gray-800 text-indigo-300 shadow-sm' : 'text-gray-500 hover:text-gray-300'}`}
           >
             <Moon className="w-4 h-4" /> Night
           </button>
        </div>
      </div>

      <div className="mt-4 mb-10 text-center space-y-4">
        <QuoteIcon className="w-8 h-8 text-teal-500 mx-auto opacity-50" />
        <p className="font-serif text-xl md:text-2xl text-gray-200 leading-relaxed italic">"{quote.text}"</p>
        <p className="text-sm text-teal-400 font-medium tracking-wide uppercase">— {quote.author}</p>
      </div>

      {session === 'morning' ? (
         <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Dreams */}
            <section>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Cloud className="w-5 h-5 text-sky-300" />
                  <h3 className="text-lg font-medium text-sky-100">Dream Journal</h3>
                </div>
                {dreams && !dreamAnalysis && (
                  <button 
                    onClick={handleDreamAnalysis} 
                    disabled={isDreamLoading}
                    className="text-xs bg-sky-900/30 text-sky-300 px-3 py-1.5 rounded-lg hover:bg-sky-900/50 transition-all flex items-center gap-1"
                  >
                    {isDreamLoading ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />} Interpret
                  </button>
                )}
              </div>
              <textarea value={dreams} onChange={(e) => setDreams(e.target.value)} placeholder="What do you remember from your sleep?" className="w-full h-24 bg-sky-900/10 border border-sky-500/20 rounded-xl p-4 text-sky-100 placeholder-sky-500/40 focus:ring-2 focus:ring-sky-500/20 resize-none leading-relaxed text-sm" />
              {dreamAnalysis && (
                <div className="mt-4 bg-sky-950/30 border border-sky-500/20 p-4 rounded-xl animate-in fade-in">
                  <div className="flex items-center gap-2 text-xs font-bold text-sky-400 uppercase mb-2">
                    <Moon className="w-3 h-3" /> Dream Meaning
                  </div>
                  <p className="text-sm text-sky-100/90 leading-relaxed italic">{dreamAnalysis}</p>
                </div>
              )}
            </section>

            {/* Gratitudes */}
            <section>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-5 h-5 rounded-full border-2 border-rose-400/50 flex items-center justify-center"><div className="w-2 h-2 bg-rose-400 rounded-full" /></div>
                <h3 className="text-lg font-medium text-rose-100">Morning Gratitude</h3>
              </div>
              <div className="space-y-3">
                {morningGratitudes.map((text, i) => (
                  <input key={`grat-${i}`} type="text" value={text} onChange={(e) => handleMorningGratitudeChange(i, e.target.value)} placeholder={`I woke up grateful for...`} className="w-full bg-gray-800/50 border border-gray-700/50 rounded-lg px-4 py-3 text-gray-200 placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-rose-500/50 transition-all" />
                ))}
              </div>
            </section>

            {/* Affirmations */}
            <section>
              <div className="flex items-center gap-2 mb-4">
                <Sun className="w-5 h-5 text-amber-400" />
                <h3 className="text-lg font-medium text-amber-100">Morning Affirmations</h3>
              </div>
              <div className="space-y-3">
                {affirmations.map((text, i) => (
                  <input key={`aff-${i}`} type="text" value={text} onChange={(e) => handleAffirmationChange(i, e.target.value)} placeholder={`I am...`} className="w-full bg-gray-800/50 border border-gray-700/50 rounded-lg px-4 py-3 text-gray-200 placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-amber-500/50 transition-all" />
                ))}
              </div>
            </section>

            {/* Intentions */}
            <section>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <Leaf className="w-5 h-5 text-emerald-400" />
                    <h3 className="text-lg font-medium text-emerald-100">Daily Intentions</h3>
                </div>
                <button 
                    onClick={handleSuggestIntentions} 
                    disabled={isSuggesting}
                    className="text-xs flex items-center gap-1 text-emerald-400 hover:text-emerald-300 transition-colors"
                >
                    {isSuggesting ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />} Suggest
                </button>
              </div>
              <div className="space-y-3">
                {intentions.map((text, i) => (
                  <input key={`int-${i}`} type="text" value={text} onChange={(e) => handleIntentionChange(i, e.target.value)} placeholder={`Today I will focus on...`} className="w-full bg-gray-800/50 border border-gray-700/50 rounded-lg px-4 py-3 text-gray-200 placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all" />
                ))}
              </div>
            </section>

            {/* Morning Pages */}
            <section>
               <div className="flex items-center gap-2 mb-4">
                 <FileText className="w-5 h-5 text-gray-400" />
                 <h3 className="text-lg font-medium text-gray-200">Morning Pages</h3>
               </div>
               <textarea value={morningFreeFlow} onChange={(e) => setMorningFreeFlow(e.target.value)} placeholder="Clear your mind. Just write..." className="w-full h-48 bg-gray-800/30 border border-gray-700/30 rounded-xl p-6 text-gray-300 placeholder-gray-600 focus:ring-2 focus:ring-gray-500/20 resize-none leading-relaxed font-serif" />
            </section>
         </div>
      ) : (
         <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Highlight */}
            <section>
              <div className="flex items-center gap-2 mb-4">
                <Star className="w-5 h-5 text-amber-400" />
                <h3 className="text-lg font-medium text-amber-100">Highlight of the Day</h3>
              </div>
              <input type="text" value={highlight} onChange={(e) => setHighlight(e.target.value)} placeholder="The best thing that happened today..." className="w-full bg-amber-900/10 border border-amber-500/20 rounded-lg px-4 py-4 text-amber-100 placeholder-amber-500/40 focus:outline-none focus:ring-2 focus:ring-amber-500/30 transition-all" />
            </section>

            {/* Wins */}
            <section>
               <div className="flex items-center gap-2 mb-4">
                 <Star className="w-5 h-5 text-yellow-500" />
                 <h3 className="text-lg font-medium text-yellow-100">Small Wins</h3>
               </div>
               <div className="space-y-3">
                {wins.map((text, i) => (
                  <input key={`win-${i}`} type="text" value={text} onChange={(e) => handleWinChange(i, e.target.value)} placeholder={`I did well at...`} className="w-full bg-gray-800/50 border border-gray-700/50 rounded-lg px-4 py-3 text-gray-200 placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-yellow-500/50 transition-all" />
                ))}
              </div>
            </section>

            {/* Learning Log (New) */}
            <section>
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                        <Book className="w-5 h-5 text-indigo-400" />
                        <h3 className="text-lg font-medium text-indigo-100">Learning & Growth</h3>
                    </div>
                    {!isAddingResource && (
                        <button onClick={() => setIsAddingResource(true)} className="text-xs flex items-center gap-1 text-indigo-400 hover:text-indigo-300">
                            <PlusCircle className="w-3 h-3" /> Add Resource
                        </button>
                    )}
                </div>

                {isAddingResource && (
                    <div className="bg-gray-900/50 border border-indigo-500/30 rounded-xl p-4 mb-4 animate-in fade-in">
                        <div className="flex gap-2 mb-3 overflow-x-auto pb-2 scrollbar-hide">
                            {['Book', 'E-book', 'Podcast', 'Tutorial', 'Practice', 'Other'].map(t => (
                                <button 
                                    key={t}
                                    onClick={() => setNewResource({...newResource, type: t})}
                                    className={`px-3 py-1.5 rounded-full text-xs whitespace-nowrap border transition-all ${newResource.type === t ? 'bg-indigo-500/20 border-indigo-500 text-indigo-300' : 'border-gray-700 text-gray-500 hover:border-gray-500'}`}
                                >
                                    {t}
                                </button>
                            ))}
                        </div>
                        <input 
                            value={newResource.title} 
                            onChange={(e) => setNewResource({...newResource, title: e.target.value})}
                            placeholder="Title / Topic" 
                            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white mb-2 focus:border-indigo-500 outline-none"
                        />
                        <div className="flex gap-2 mb-2">
                             <input 
                                value={newResource.progress} 
                                onChange={(e) => setNewResource({...newResource, progress: e.target.value})}
                                placeholder="Progress (e.g. 30m, Ch 5)" 
                                className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:border-indigo-500 outline-none"
                            />
                        </div>
                        <textarea
                            value={newResource.takeaway}
                            onChange={(e) => setNewResource({...newResource, takeaway: e.target.value})}
                            placeholder="One key takeaway..."
                            className="w-full h-16 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white mb-3 focus:border-indigo-500 outline-none resize-none"
                        />
                        <div className="flex justify-end gap-2">
                            <button onClick={() => setIsAddingResource(false)} className="px-3 py-1.5 text-xs text-gray-500 hover:text-white">Cancel</button>
                            <button onClick={handleAddResource} disabled={!newResource.title} className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-lg uppercase tracking-wide disabled:opacity-50">Add Log</button>
                        </div>
                    </div>
                )}

                <div className="space-y-3">
                    {learningLog.map(item => (
                        <div key={item.id} className="bg-gray-800/30 border border-gray-700/50 rounded-lg p-4 relative group">
                            <button onClick={() => handleRemoveResource(item.id)} className="absolute top-2 right-2 text-gray-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 className="w-3 h-3" /></button>
                            <div className="flex justify-between items-start mb-1">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-400 border border-indigo-500/20 px-1.5 py-0.5 rounded bg-indigo-900/10">{item.type}</span>
                                <span className="text-xs text-gray-500 font-mono">{item.progress}</span>
                            </div>
                            <h4 className="text-sm font-medium text-white mb-1">{item.title}</h4>
                            {item.takeaway && <p className="text-xs text-gray-400 italic">"{item.takeaway}"</p>}
                        </div>
                    ))}
                    {learningLog.length === 0 && !isAddingResource && (
                        <div onClick={() => setIsAddingResource(true)} className="text-center p-6 border border-dashed border-gray-800 rounded-xl text-gray-600 text-xs cursor-pointer hover:border-indigo-500/30 hover:text-indigo-400 transition-all">
                            No learning logged today. Click to add a book, podcast, or insight.
                        </div>
                    )}
                </div>
            </section>

            {/* Reflections (Dynamic) */}
            <section>
              <div className="flex items-center gap-2 mb-4">
                <PenTool className="w-5 h-5 text-indigo-400" />
                <h3 className="text-lg font-medium text-indigo-100">Guided Reflection</h3>
              </div>
              <div className="space-y-6">
                {reflections.map((reflection, index) => (
                  <div key={reflection.id} className="group relative bg-gray-800/30 border border-gray-700/30 rounded-xl p-6 transition-all hover:border-indigo-500/30">
                    <div className="flex justify-between items-start mb-4">
                      <p className="text-sm text-indigo-200/80 italic font-serif pr-8">{reflection.prompt}</p>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity absolute top-4 right-4 bg-gray-900/80 rounded-lg p-1">
                        <button onClick={() => cyclePrompt(reflection.id)} className="p-1.5 text-indigo-300 hover:text-white transition-colors rounded hover:bg-white/10" title="New Prompt"><RefreshCw className="w-3.5 h-3.5" /></button>
                        {reflections.length > 1 && <button onClick={() => removeReflectionBlock(reflection.id)} className="p-1.5 text-red-400 hover:text-red-200 transition-colors rounded hover:bg-red-500/20" title="Remove"><Trash2 className="w-3.5 h-3.5" /></button>}
                      </div>
                    </div>
                    <textarea value={reflection.text} onChange={(e) => handleReflectionChange(reflection.id, e.target.value)} placeholder="Start writing..." className="w-full h-32 bg-transparent border-0 resize-none text-gray-300 placeholder-gray-600 focus:ring-0 leading-relaxed" />
                  </div>
                ))}
                <button onClick={addReflectionBlock} className="w-full py-4 border border-dashed border-gray-700 rounded-xl text-gray-500 hover:text-indigo-400 hover:border-indigo-500/50 hover:bg-gray-800/50 transition-all flex items-center justify-center gap-2 group">
                  <PlusCircle className="w-5 h-5 group-hover:scale-110 transition-transform" /> <span>Add another reflection</span>
                </button>
              </div>
            </section>
            
            {/* Letting Go */}
            <section className="relative">
              <div className="flex items-center gap-2 mb-4">
                <XCircle className="w-5 h-5 text-stone-400" />
                <h3 className="text-lg font-medium text-stone-200">Letting Go</h3>
              </div>
              <div className="bg-stone-900/30 border border-stone-800 rounded-xl p-4">
                 <textarea value={lettingGo} onChange={(e) => setLettingGo(e.target.value)} placeholder="What do you want to release before sleeping?" className="w-full h-24 bg-transparent border-0 resize-none text-stone-300 placeholder-stone-700 focus:ring-0 leading-relaxed text-sm" />
              </div>
            </section>
            
            {/* Gemini Companion Section */}
            <section className="mt-12 pt-12 border-t border-gray-800">
               <div className="flex items-center gap-2 mb-6">
                 <Sparkles className="w-5 h-5 text-teal-400 animate-pulse" />
                 <h3 className="text-lg font-medium text-teal-100">AI Companion</h3>
               </div>
               {!aiInsight ? (
                    <button onClick={handleGenerateInsight} disabled={isAiLoading} className="w-full p-6 bg-gradient-to-br from-teal-900/40 to-gray-900 rounded-xl border border-teal-500/20 hover:border-teal-500/50 hover:from-teal-900/50 transition-all text-left group">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="p-2 bg-teal-500/20 rounded-lg text-teal-300 group-hover:scale-110 transition-transform"><Sparkles className="w-5 h-5" /></div>
                        <span className="font-medium text-teal-100">Reflect with Gemini</span>
                      </div>
                      <p className="text-sm text-gray-400 leading-relaxed">Ask for a deep, personalized insight based on your entry today. A moment of Zen clarity.</p>
                    </button>
               ) : (
                 <div className="bg-gradient-to-br from-gray-900 to-teal-950/30 border border-teal-500/20 rounded-xl p-6 relative overflow-hidden">
                   <div className="flex justify-between items-start mb-4">
                      <div className="flex items-center gap-2 text-teal-300 text-sm font-medium uppercase tracking-wider"><Sparkles className="w-4 h-4" /> Insight</div>
                      <div className="flex gap-2">
                         <button onClick={handlePlayAudio} disabled={isAudioLoading} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${isPlaying ? 'bg-teal-500/20 text-teal-300 animate-pulse' : 'bg-gray-800 text-gray-400 hover:text-white'}`}>
                           {isAudioLoading ? <RefreshCw className="w-3 h-3 animate-spin" /> : isPlaying ? <Square className="w-3 h-3 fill-current" /> : <Play className="w-3 h-3 fill-current" />}
                           {isPlaying ? 'Stop' : 'Listen'}
                         </button>
                         <button onClick={() => setAiInsight(null)} className="p-1 hover:text-white text-gray-500 transition-colors"><RefreshCw className="w-4 h-4" /></button>
                      </div>
                   </div>
                   <p className="text-gray-200 leading-relaxed font-serif text-lg italic opacity-90">{aiInsight}</p>
                 </div>
               )}
               {isAiLoading && <div className="mt-4 text-center text-sm text-teal-400/70 animate-pulse flex items-center justify-center gap-2"><Sparkles className="w-4 h-4 animate-spin" /> Consulting the stars...</div>}
            </section>
         </div>
      )}

      <div className="fixed bottom-24 right-6 pointer-events-none z-40">
         <div className={`flex items-center gap-2 bg-gray-900/80 backdrop-blur px-3 py-1.5 rounded-full border border-gray-800 transition-opacity duration-500 ${isSaving ? 'opacity-100' : 'opacity-0'}`}>
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            <span className="text-xs text-gray-400">Saving...</span>
         </div>
      </div>
    </div>
  );
};

// 4. History Component
const HistoryView = ({ user, onSelectDate }: { user: User | null, onSelectDate: (d: string) => void }) => {
  const [entries, setEntries] = useState<any[]>([]);
  const [isSummarizing, setIsSummarizing] = useState(false);

  useEffect(() => {
    if (!user || !db) return;
    const q = query(collection(db, 'artifacts', appId, 'users', user.uid, 'journal'), orderBy('date', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setEntries(data);
    });
    return () => unsubscribe();
  }, [user]);

  const handleGenerateDailySummary = async (entry: any, e: React.MouseEvent) => {
      e.stopPropagation();
      setIsSummarizing(true);
      
      const context = `
         Date: ${entry.date}
         Mood: ${entry.weather}
         Sleep: ${entry.sleep}
         Energy: ${entry.energy}%
         Gratitude: ${entry.morningGratitudes?.join(', ')}
         Intentions: ${entry.intentions?.join(', ')}
         Highlights: ${entry.highlight}
         Wins: ${entry.wins?.join(', ')}
         Breathwork: ${entry.breathMinutes} mins
         CBT Sessions: ${entry.cbtEntries?.length || 0}
         Tool Practice: ${entry.dailyToolResponse ? 'Completed' : 'Skipped'}
      `;
      
      const prompt = `Based on this data, write a warm, encouraging 3-sentence summary of this person's day. Acknowledge their effort.`;
      const result = await callGemini(prompt + context, "You are a supportive mindfulness coach.");
      
      // Save to DB
      if (user && db) {
          await updateDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'journal', entry.date), { dailySummary: result });
      }
      setIsSummarizing(false);
  };

  const getWeatherIcon = (id: string) => {
    const w = WEATHER_MOODS.find(m => m.id === id);
    if (!w) return null;
    const Icon = w.icon;
    return <Icon className={`w-4 h-4 ${w.color}`} />;
  };

  const renderBadge = (label: string, icon: any, colorClass: string) => {
      const Icon = icon;
      return (
          <span className={`text-[10px] uppercase tracking-wider px-2 py-1 rounded flex items-center gap-1 border ${colorClass}`}>
              <Icon className="w-3 h-3" /> {label}
          </span>
      );
  };

  // --- FIX: Added Mood Streak Logic ---
  const renderMoodStreak = () => {
      const days = [];
      for(let i=6; i>=0; i--) {
          const d = new Date();
          d.setDate(d.getDate() - i);
          days.push(d.toISOString().split('T')[0]);
      }
      
      return (
          <div className="flex justify-between items-center mb-6 bg-gray-900/30 p-4 rounded-xl border border-gray-800">
              <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">7 Day Mood</span>
              <div className="flex gap-2">
                  {days.map(date => {
                      const entry = entries.find(e => e.date === date);
                      const w = entry?.weather ? WEATHER_MOODS.find(m => m.id === entry.weather) : null;
                      const Icon = w ? w.icon : Sun;
                      // Convert text color class to border/bg for dot
                      const color = w ? w.color : 'text-gray-700';
                      const borderColor = w ? w.color.replace('text-', 'border-') : 'border-gray-800';
                      
                      return (
                          <div key={date} className={`w-6 h-6 rounded-full flex items-center justify-center border ${borderColor} ${w ? 'bg-gray-800' : 'bg-transparent'}`} title={`${date}: ${entry?.weather || 'No Data'}`}>
                              {w && <Icon className={`w-3 h-3 ${color}`} />}
                          </div>
                      );
                  })}
              </div>
          </div>
      );
  };

  return (
    <div className="max-w-2xl mx-auto p-6 pb-24 animate-in fade-in duration-500">
      <h2 className="text-2xl font-light text-white mb-6">Your Journey</h2>
      
      {/* Streak Viz */}
      {renderMoodStreak()}

      <div className="space-y-4">
        {entries.length === 0 && (
          <div className="text-center py-20 text-gray-500">
            <History className="w-12 h-12 mx-auto mb-4 opacity-20" />
            <p>No entries yet. Start your journey today.</p>
          </div>
        )}
        {entries.map((entry) => (
          <div 
            key={entry.id} 
            onClick={() => onSelectDate(entry.date)} 
            className="w-full text-left bg-gray-900/50 hover:bg-gray-800 border border-gray-800 hover:border-gray-700 p-5 rounded-xl transition-all group relative cursor-pointer"
            role="button"
            tabIndex={0}
          >
            
            {/* Header Date & Weather */}
            <div className="flex justify-between items-start mb-3">
               <div>
                   <h4 className="text-lg font-medium text-gray-200">{new Date(entry.date).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}</h4>
                   {entry.weather && (
                       <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
                           {getWeatherIcon(entry.weather)}
                           <span className="capitalize">{entry.weather}</span>
                       </div>
                   )}
               </div>
               <ChevronRight className="w-5 h-5 text-gray-600 group-hover:text-teal-400 transition-colors" />
            </div>

            {/* --- FIX: Added Vitals Insight Display --- */}
            {entry.vitalsInsight && (
                <div className="mb-3 p-3 bg-purple-900/10 border border-purple-500/20 rounded-lg">
                    <div className="flex items-center gap-2 text-[10px] font-bold text-purple-400 uppercase mb-1">
                        <Activity className="w-3 h-3" /> Body Insight
                    </div>
                    <p className="text-xs text-purple-200/80 italic leading-relaxed">"{entry.vitalsInsight}"</p>
                </div>
            )}

            {/* Daily Summary AI */}
            {entry.dailySummary ? (
                <div className="bg-teal-950/20 border border-teal-500/20 rounded-lg p-3 mb-4">
                    <div className="flex items-center gap-2 text-[10px] font-bold text-teal-400 uppercase mb-1">
                        <Sparkles className="w-3 h-3" /> Daily Recap
                    </div>
                    <p className="text-xs text-teal-100/80 leading-relaxed italic">{entry.dailySummary}</p>
                </div>
            ) : (
                <div className="mb-4">
                    <div 
                        onClick={(e) => handleGenerateDailySummary(entry, e)}
                        className="text-[10px] bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white px-2 py-1 rounded border border-gray-700 transition-colors flex items-center gap-1 w-fit cursor-pointer"
                        role="button"
                    >
                        {isSummarizing ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />} Generate Recap
                    </div>
                </div>
            )}

            {/* Quote Snippet */}
            <p className="text-xs text-gray-500 line-clamp-1 italic mb-4 border-l-2 border-gray-700 pl-3">"{entry.quote?.text || 'No quote'}"</p>

            {/* Badges Grid */}
            <div className="flex flex-wrap gap-2">
                {/* Physical & Vitals */}
                {entry.hydration > 0 && renderBadge(entry.hydration + '', Droplet, 'text-sky-300 bg-sky-900/20 border-sky-800')}
                {entry.alignment > 0 && renderBadge('Align ' + entry.alignment, Compass, 'text-purple-300 bg-purple-900/20 border-purple-800')}
                {entry.waketime && renderBadge('Up ' + entry.waketime, Clock, 'text-indigo-300 bg-indigo-900/20 border-indigo-800')}
                {entry.social && entry.social.length > 0 && renderBadge(entry.social.length + ' Connects', Users, 'text-blue-300 bg-blue-900/20 border-blue-800')}
                {entry.nightVitals?.socialBattery > 0 && renderBadge('Bat ' + entry.nightVitals.socialBattery + '%', Zap, 'text-green-300 bg-green-900/20 border-green-800')}
                {entry.breathMinutes > 0 && renderBadge(entry.breathMinutes + 'm', Wind, 'text-purple-300 bg-purple-900/20 border-purple-800')}
                
                {/* Mental */}
                {entry.dailyToolResponse && renderBadge('Tool', Brain, 'text-indigo-300 bg-indigo-900/20 border-indigo-800')}
                {entry.cbtEntries?.length > 0 && renderBadge('Deep Work', Cloud, 'text-indigo-300 bg-indigo-900/20 border-indigo-800')}
                
                {/* Journal */}
                {entry.intentions?.some((i:string) => i) && renderBadge('Intentions', Target, 'text-teal-300 bg-teal-900/20 border-teal-800')}
                {entry.affirmations?.some((a:string) => a) && renderBadge('Affirmations', Sun, 'text-amber-300 bg-amber-900/20 border-amber-800')}
                {entry.morningGratitudes?.some((g:string) => g) && renderBadge('Gratitude', Heart, 'text-rose-300 bg-rose-900/20 border-rose-800')}
                {entry.dreams && renderBadge('Dream', Moon, 'text-sky-300 bg-sky-900/20 border-sky-800')}
                {entry.lettingGo && renderBadge('Let Go', XCircle, 'text-gray-300 bg-gray-800 border-gray-700')}
                {entry.highlight && renderBadge('Highlight', Star, 'text-amber-400 bg-amber-900/20 border-amber-800')}
                {entry.wins?.some((w:string) => w) && renderBadge('Wins', CheckCircle, 'text-yellow-400 bg-yellow-900/20 border-yellow-800')}
                {entry.reflections?.some((r:any) => r.text) && renderBadge('Reflect', PenTool, 'text-indigo-400 bg-indigo-900/20 border-indigo-800')}
                
                {/* Learning Badge */}
                {entry.learningLog?.length > 0 && renderBadge(`Learned (${entry.learningLog.length})`, Book, 'text-indigo-300 bg-indigo-900/20 border-indigo-800')}
            </div>

            {/* --- FIX: Added Expanded Learning Log Details --- */}
            {entry.learningLog?.length > 0 && (
                <div className="mt-3 pl-3 border-l border-indigo-500/20 space-y-1">
                    {entry.learningLog.map((l:any, i:number) => (
                        <div key={i} className="text-[10px] text-indigo-300/80 truncate">
                           • <span className="text-indigo-200">{l.title}</span> <span className="opacity-50">({l.type})</span>
                        </div>
                    ))}
                </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

// --- Main App Component ---

export default function MindfulnessApp() {
  const [user, setUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState<'journey' | 'vitals' | 'reflect' | 'cbt' | 'breathe'>('reflect');
  const [currentDate, setCurrentDate] = useState(getTodayString());
  const [vitalsData, setVitalsData] = useState<any>(null);
  
  // Theme State
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [font, setFont] = useState<'sans' | 'serif' | 'mono'>('sans');
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    if (!auth) return;
    const initAuth = async () => {
      const initialToken = (window as any).__initial_auth_token;
      if (initialToken) {
        try { await signInWithCustomToken(auth, initialToken); } catch (e) { await signInAnonymously(auth); }
      } else { await signInAnonymously(auth); }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, setUser);
    return () => unsubscribe();
  }, []);

  const handleDateSelect = (date: string) => { setCurrentDate(date); setActiveTab('reflect'); };
  const formattedDate = new Date(currentDate).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  const isToday = currentDate === getTodayString();

  return (
    <div className={`min-h-screen transition-colors duration-500 selection:bg-teal-500/30 ${theme === 'light' ? 'bg-gray-50 text-gray-900' : 'bg-[#050507] text-gray-300'} ${font === 'serif' ? 'font-serif' : font === 'mono' ? 'font-mono' : 'font-sans'}`}>
      
      {/* Styles for badges and font */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@300;400;500;600&display=swap');
        .font-sans { font-family: 'Montserrat', sans-serif !important; }
        .badge-blue { @apply text-[10px] uppercase tracking-wider text-sky-400 bg-sky-900/20 px-2 py-1 rounded flex items-center gap-1 border border-sky-500/10; }
        .badge-green { @apply text-[10px] uppercase tracking-wider text-emerald-400 bg-emerald-900/20 px-2 py-1 rounded flex items-center gap-1 border border-emerald-500/10; }
        .badge-orange { @apply text-[10px] uppercase tracking-wider text-orange-400 bg-orange-900/20 px-2 py-1 rounded flex items-center gap-1 border border-orange-500/10; }
        .badge-purple { @apply text-[10px] uppercase tracking-wider text-purple-400 bg-purple-900/20 px-2 py-1 rounded flex items-center gap-1 border border-purple-500/10; }
        .badge-indigo { @apply text-[10px] uppercase tracking-wider text-indigo-400 bg-indigo-900/20 px-2 py-1 rounded flex items-center gap-1 border border-indigo-500/10; }
        .badge-teal { @apply text-[10px] uppercase tracking-wider text-teal-400 bg-teal-900/20 px-2 py-1 rounded flex items-center gap-1 border border-teal-500/10; }
        .badge-rose { @apply text-[10px] uppercase tracking-wider text-rose-400 bg-rose-900/20 px-2 py-1 rounded flex items-center gap-1 border border-rose-500/10; }
        .badge-sky { @apply text-[10px] uppercase tracking-wider text-sky-300 bg-sky-900/20 px-2 py-1 rounded flex items-center gap-1 border border-sky-500/10; }
        .badge-gray { @apply text-[10px] uppercase tracking-wider text-gray-400 bg-gray-800 px-2 py-1 rounded flex items-center gap-1 border border-gray-700; }
      `}</style>

      {/* Settings Modal */}
      {showSettings && (
          <div className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm flex items-center justify-center p-6 animate-in fade-in">
              <div className={`w-full max-w-sm p-6 rounded-2xl border shadow-2xl ${theme === 'light' ? 'bg-white border-gray-200 text-gray-900' : 'bg-zinc-900 border-white/10 text-white'}`}>
                  <div className="flex justify-between items-center mb-6">
                      <h3 className="text-lg font-medium">Appearance</h3>
                      <button onClick={() => setShowSettings(false)}><XCircle className="w-6 h-6 opacity-50 hover:opacity-100" /></button>
                  </div>
                  
                  <div className="space-y-6">
                      <div>
                          <label className="text-xs uppercase tracking-widest opacity-60 mb-3 block">Theme</label>
                          <div className="grid grid-cols-2 gap-2">
                              <button onClick={() => setTheme('dark')} className={`p-3 rounded-xl border flex items-center justify-center gap-2 transition-all ${theme === 'dark' ? 'border-teal-500 bg-teal-500/10 text-teal-500' : 'border-transparent bg-black/5 dark:bg-white/5'}`}>
                                  <Moon className="w-4 h-4" /> Midnight
                              </button>
                              <button onClick={() => setTheme('light')} className={`p-3 rounded-xl border flex items-center justify-center gap-2 transition-all ${theme === 'light' ? 'border-teal-500 bg-teal-500/10 text-teal-500' : 'border-transparent bg-black/5 dark:bg-white/5'}`}>
                                  <Sun className="w-4 h-4" /> Paper
                              </button>
                          </div>
                      </div>

                      <div>
                          <label className="text-xs uppercase tracking-widest opacity-60 mb-3 block">Typography</label>
                          <div className="grid grid-cols-3 gap-2">
                              <button onClick={() => setFont('sans')} className={`p-3 rounded-xl border text-sm font-sans transition-all ${font === 'sans' ? 'border-teal-500 bg-teal-500/10 text-teal-500' : 'border-transparent bg-black/5 dark:bg-white/5'}`}>Modern</button>
                              <button onClick={() => setFont('serif')} className={`p-3 rounded-xl border text-sm font-serif transition-all ${font === 'serif' ? 'border-teal-500 bg-teal-500/10 text-teal-500' : 'border-transparent bg-black/5 dark:bg-white/5'}`}>Elegant</button>
                              <button onClick={() => setFont('mono')} className={`p-3 rounded-xl border text-sm font-mono transition-all ${font === 'mono' ? 'border-teal-500 bg-teal-500/10 text-teal-500' : 'border-transparent bg-black/5 dark:bg-white/5'}`}>Typewriter</button>
                          </div>
                      </div>
                  </div>
              </div>
          </div>
      )}

      <header className={`fixed top-0 left-0 right-0 z-40 transition-all duration-500 ${activeTab === 'breathe' ? 'bg-transparent border-transparent' : `${theme === 'light' ? 'bg-white/80 border-gray-200' : 'bg-[#050507]/80 border-white/5'} backdrop-blur-md border-b`} h-16 flex items-center justify-between px-6 pointer-events-none`}>
        <div className={`flex items-center gap-4 pointer-events-auto ${activeTab === 'breathe' ? 'opacity-0' : 'opacity-100'}`}>
          <button onClick={() => setShowSettings(true)} className="p-2 -ml-2 rounded-full hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
              <Settings className={`w-5 h-5 ${theme === 'light' ? 'text-gray-600' : 'text-gray-400'}`} />
          </button>
          <h1 className={`text-lg font-light tracking-wider ${theme === 'light' ? 'text-gray-900' : 'text-white'}`}><span className="font-semibold text-teal-500">Mind</span>ful</h1>
        </div>
        
        {activeTab !== 'breathe' && (
           <div className={`flex items-center gap-3 rounded-full px-1 p-1 border pointer-events-auto ${theme === 'light' ? 'bg-gray-100 border-gray-200' : 'bg-gray-900 border-gray-800'}`}>
             <button onClick={() => { const d = new Date(currentDate); d.setDate(d.getDate() - 1); setCurrentDate(d.toISOString().split('T')[0]); }} className={`p-1 transition-colors ${theme === 'light' ? 'hover:text-black text-gray-500' : 'hover:text-white text-gray-500'}`}><ChevronLeft className="w-4 h-4" /></button>
             <span className={`text-xs font-medium min-w-[80px] text-center ${theme === 'light' ? 'text-gray-700' : 'text-gray-300'}`}>{isToday ? 'Today' : formattedDate}</span>
             <button onClick={() => { const d = new Date(currentDate); d.setDate(d.getDate() + 1); const nextDay = d.toISOString().split('T')[0]; if (nextDay <= getTodayString()) { setCurrentDate(nextDay); } }} disabled={isToday} className={`p-1 transition-colors ${isToday ? 'text-gray-300 dark:text-gray-700' : 'hover:text-black dark:hover:text-white text-gray-500'}`}><ChevronRight className="w-4 h-4" /></button>
           </div>
        )}
      </header>

      <main className="pt-20 h-screen overflow-y-auto scrollbar-hide" style={{ paddingTop: activeTab === 'breathe' ? 0 : '5rem' }}>
        {/* We keep all tabs mounted (using hidden) to preserve state and ensure auto-save completes */}
        <div className={activeTab === 'reflect' ? 'block' : 'hidden'}>
            <JournalEntry user={user} dateStr={currentDate} vitals={vitalsData} />
        </div>
        <div className={activeTab === 'vitals' ? 'block' : 'hidden'}>
            <VitalsView user={user} dateStr={currentDate} onSave={setVitalsData} />
        </div>
        <div className={activeTab === 'cbt' ? 'block' : 'hidden'}>
            <ClarityView user={user} dateStr={currentDate} />
        </div>
        <div className={activeTab === 'breathe' ? 'block h-full' : 'hidden'}>
            <BreathVisual user={user} dateStr={currentDate} isActiveTab={activeTab === 'breathe'} theme={theme} />
        </div>
        <div className={activeTab === 'journey' ? 'block' : 'hidden'}>
            <HistoryView user={user} onSelectDate={handleDateSelect} />
        </div>
      </main>

      <nav className={`fixed bottom-0 left-0 right-0 z-50 backdrop-blur-xl border-t pb-safe ${theme === 'light' ? 'bg-white/90 border-gray-200' : 'bg-[#050507]/90 border-white/5'}`}>
        <div className="flex justify-around items-center h-20 max-w-md mx-auto">
          <button onClick={() => setActiveTab('vitals')} className={`flex flex-col items-center gap-1.5 w-14 transition-colors duration-300 ${activeTab === 'vitals' ? 'text-rose-500' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-200'}`}>
            <Activity className={`w-5 h-5 ${activeTab === 'vitals' ? 'drop-shadow-[0_0_8px_rgba(244,63,94,0.4)]' : ''}`} />
            <span className="text-[9px] uppercase tracking-widest">Vitals</span>
          </button>
          <button onClick={() => setActiveTab('reflect')} className={`flex flex-col items-center gap-1.5 w-14 transition-colors duration-300 ${activeTab === 'reflect' ? 'text-teal-500' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-200'}`}>
            <BookOpen className={`w-5 h-5 ${activeTab === 'reflect' ? 'drop-shadow-[0_0_8px_rgba(20,184,166,0.4)]' : ''}`} />
            <span className="text-[9px] uppercase tracking-widest">Reflect</span>
          </button>
          <button onClick={() => setActiveTab('cbt')} className={`flex flex-col items-center gap-1.5 w-14 transition-colors duration-300 ${activeTab === 'cbt' ? 'text-amber-500' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-200'}`}>
            <Cloud className={`w-5 h-5 ${activeTab === 'cbt' ? 'drop-shadow-[0_0_8px_rgba(245,158,11,0.4)]' : ''}`} />
            <span className="text-[9px] uppercase tracking-widest">Clarity</span>
          </button>
          <button onClick={() => setActiveTab('breathe')} className={`flex flex-col items-center gap-1.5 w-14 transition-colors duration-300 ${activeTab === 'breathe' ? 'text-purple-500' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-200'}`}>
            <Wind className={`w-5 h-5 ${activeTab === 'breathe' ? 'drop-shadow-[0_0_8px_rgba(168,85,247,0.4)]' : ''}`} />
            <span className="text-[9px] uppercase tracking-widest">Breathe</span>
          </button>
          <button onClick={() => setActiveTab('journey')} className={`flex flex-col items-center gap-1.5 w-14 transition-colors duration-300 ${activeTab === 'journey' ? (theme === 'light' ? 'text-black' : 'text-white') : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-200'}`}>
            <History className={`w-5 h-5 ${activeTab === 'journey' ? 'drop-shadow-[0_0_8px_rgba(120,120,120,0.3)]' : ''}`} />
            <span className="text-[9px] uppercase tracking-widest">Journey</span>
          </button>
        </div>
      </nav>
    </div>
  );
}
