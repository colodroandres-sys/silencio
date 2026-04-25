const state = {
  userInput:   '',
  userName:    '',
  duration:    '5',
  voice:       'auto',
  music:       'auto',
  gender:      'neutro',
  intent:      null,
  emotionTag:  null,
  userPlan:    'free',
  userCanGenerate: true,
  isPlaying:   false,
  currentSec:  0,
  totalSec:    0,
  audioBlobUrl:         null,
  currentMeditationId: null,
  silenceMap:          [],
  silenceOffset:       0,
  silenceTimer:        null,
  silenceTimeoutId:    null,
  introTimeoutId:      null,
  ambientFadeInterval: null,
  inSilence:           false,
  creditsRemaining:    0,
  creditsLimit:        0,
  savedCount:          0,
  saveLimit:           null,
  durationCredits: { '5': 1, '10': 2, '15': 3, '20': 4 },
  streak:          0,
  minutesThisWeek: 0,
  totalSessions:   0,
  level:           'Inquieto',
  weekHistory:     [0,0,0,0,0,0,0]
};

const obPrefs = {
  voice:    localStorage.getItem('ob_voice')    || 'auto',
  gender:   localStorage.getItem('ob_gender')   || 'neutro',
  duration: localStorage.getItem('ob_duration') || '5',
  goal:     localStorage.getItem('ob_goal')     || null,
  topics:   JSON.parse(localStorage.getItem('ob_topics') || '[]')
};

let abortController = null;
let slowTimer       = null;
let shakeInterval   = null;
let obPreviewPlaying = false;
