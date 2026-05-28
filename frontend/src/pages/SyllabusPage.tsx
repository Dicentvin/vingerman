import { useState, useEffect } from 'react'
import { useAppSelector } from '../hooks/redux'
import { Link } from 'react-router-dom'
import {
  BookOpen, CheckCircle2, Circle, ChevronDown, ChevronUp,
  Headphones, FileText, PenLine, Mic, Star, Trophy,
  ArrowRight, Zap, Target,
} from 'lucide-react'
import api from '../utils/api'

// ─── Syllabus data ─────────────────────────────────────────────────────────────

const SYLLABUS = {
  A1: {
    title: 'Goethe-Zertifikat A1',
    subtitle: 'Start Deutsch 1',
    description: 'The A1 exam proves you can introduce yourself, handle very basic everyday situations, and understand simple questions about personal topics.',
    examFormat: [
      { skill: 'Hören',    icon: '🎧', duration: '20 min', parts: 3, description: 'Listen to short dialogues, announcements, phone messages' },
      { skill: 'Lesen',    icon: '📖', duration: '25 min', parts: 3, description: 'Read short texts: forms, notices, signs, simple messages' },
      { skill: 'Schreiben',icon: '✍️', duration: '20 min', parts: 2, description: 'Fill in a form; write a short message (card, SMS, note)' },
      { skill: 'Sprechen', icon: '🗣️', duration: '15 min', parts: 3, description: 'Introduce yourself; ask questions; respond to prompts' },
    ],
    topics: [
      {
        id: 'a1-personal',
        title: 'Personal Information',
        icon: '👤',
        color: 'text-gold bg-gold/10 border-gold/20',
        vocabTopic: 'personal information',
        items: [
          'Name, age, nationality, address',
          'Family members: Mutter, Vater, Bruder, Schwester',
          'Marital status: ledig, verheiratet, geschieden',
          'Professions: Lehrer, Arzt, Ingenieur, Student',
          'Hobbies: lesen, kochen, Sport treiben, Musik hören',
        ],
        grammar: [
          { rule: 'Personal pronouns: ich, du, er, sie, es, wir, ihr, sie/Sie', id: 'a1-g1' },
          { rule: 'Verb "sein" in present tense: Ich bin, du bist…', id: 'a1-g2' },
          { rule: 'Verb "haben" in present tense: Ich habe, du hast…', id: 'a1-g3' },
          { rule: 'Nominative case: der/die/das (subject)', id: 'a1-g4' },
        ],
      },
      {
        id: 'a1-daily',
        title: 'Daily Life & Routines',
        icon: '🏠',
        color: 'text-teal-soft bg-teal-muted border-teal-soft/20',
        vocabTopic: 'daily life',
        items: [
          'Time expressions: Uhr, morgens, abends, heute, morgen',
          'Days of the week: Montag bis Sonntag',
          'Months: Januar bis Dezember',
          'Daily activities: aufstehen, frühstücken, schlafen',
          'Rooms in a house: Küche, Wohnzimmer, Schlafzimmer',
        ],
        grammar: [
          { rule: 'Regular verb conjugation: -e, -st, -t, -en, -t, -en', id: 'a1-g5' },
          { rule: 'Separable verbs: aufstehen → ich stehe auf', id: 'a1-g6' },
          { rule: 'Modal verbs: können, müssen, wollen (present)', id: 'a1-g7' },
          { rule: 'Accusative case: den/die/das (direct object)', id: 'a1-g8' },
        ],
      },
      {
        id: 'a1-food',
        title: 'Food & Shopping',
        icon: '🛒',
        color: 'text-orange-400 bg-orange-500/10 border-orange-400/20',
        vocabTopic: 'food and shopping',
        items: [
          'Food and drink: Brot, Milch, Wasser, Kaffee, Fleisch',
          'Shopping vocabulary: kaufen, bezahlen, kosten, Preis',
          'Numbers 1–1000 and prices',
          'Containers: eine Flasche, ein Kilo, eine Packung',
          'At a restaurant: bestellen, die Speisekarte, die Rechnung',
        ],
        grammar: [
          { rule: 'Indefinite article: ein/eine/ein (Nominative)', id: 'a1-g9' },
          { rule: 'Negation: kein/keine — kein Brot, keine Milch', id: 'a1-g10' },
          { rule: 'Question words: Was kostet…? Wie viel…?', id: 'a1-g11' },
          { rule: 'Imperative: Geben Sie mir bitte…', id: 'a1-g12' },
        ],
      },
      {
        id: 'a1-travel',
        title: 'Travel & Directions',
        icon: '🚉',
        color: 'text-blue-400 bg-blue-500/10 border-blue-400/20',
        vocabTopic: 'travel and directions',
        items: [
          'Transport: Bus, Bahn, Taxi, Flugzeug, Fahrrad',
          'Directions: links, rechts, geradeaus, die Straße',
          'Places in a city: Bahnhof, Rathaus, Krankenhaus',
          'Tickets: einfach, hin und zurück, erste/zweite Klasse',
          'Countries and cities: Deutschland, Österreich, Schweiz',
        ],
        grammar: [
          { rule: 'Prepositions of place: in, an, auf, neben (+ Dative)', id: 'a1-g13' },
          { rule: 'Dative case: dem/der/dem', id: 'a1-g14' },
          { rule: 'Prepositions of direction: nach, zu, in (+ Accusative)', id: 'a1-g15' },
          { rule: 'Yes/no questions: Fährt der Bus nach…?', id: 'a1-g16' },
        ],
      },
      {
        id: 'a1-health',
        title: 'Health & Body',
        icon: '🏥',
        color: 'text-red-400 bg-red-500/10 border-red-400/20',
        vocabTopic: 'health and body',
        items: [
          'Body parts: Kopf, Arm, Bein, Bauch, Rücken',
          'Ailments: Kopfschmerzen, Fieber, Erkältung, krank sein',
          'At the doctor: der Arzt, das Rezept, die Apotheke',
          'Feelings: müde, glücklich, traurig, hungrig, durstig',
          'Emergency expressions: Hilfe! Rufen Sie einen Arzt!',
        ],
        grammar: [
          { rule: 'Possessive articles: mein/meine, dein/deine', id: 'a1-g17' },
          { rule: 'Accusative with possessives: meinen Arm', id: 'a1-g18' },
          { rule: 'Adjective endings (basic): ein großer Kopf', id: 'a1-g19' },
          { rule: 'Conjunctions: und, oder, aber, denn', id: 'a1-g20' },
        ],
      },
    ],
    examTips: [
      { tip: 'Hören: The audio plays only once. Read the questions before listening.', icon: '🎧' },
      { tip: 'Lesen: Scan for keywords — you don\'t need to understand every word.', icon: '👁️' },
      { tip: 'Schreiben: For the form, write clearly. For the message, write 20–30 words.', icon: '✍️' },
      { tip: 'Sprechen: Speak slowly and clearly. It\'s OK to pause and think.', icon: '🗣️' },
      { tip: 'Always check noun genders — der/die/das matters in every answer.', icon: '⚠️' },
    ],
  },

  A2: {
    title: 'Goethe-Zertifikat A2',
    subtitle: 'Elementary German',
    description: 'The A2 exam proves you can communicate in simple, routine situations about familiar topics — work, shopping, family, and daily life.',
    examFormat: [
      { skill: 'Hören',    icon: '🎧', duration: '30 min', parts: 4, description: 'Conversations, radio announcements, phone calls, short interviews' },
      { skill: 'Lesen',    icon: '📖', duration: '30 min', parts: 4, description: 'Emails, notices, short articles, online posts, timetables' },
      { skill: 'Schreiben',icon: '✍️', duration: '30 min', parts: 2, description: 'Reply to an email/message; write a short structured text (60–80 words)' },
      { skill: 'Sprechen', icon: '🗣️', duration: '15 min', parts: 3, description: 'Describe a picture; make/respond to a request; solve a task together' },
    ],
    topics: [
      {
        id: 'a2-work',
        title: 'Work & Career',
        icon: '💼',
        color: 'text-violet-soft bg-violet-muted border-violet-soft/20',
        vocabTopic: 'work and career',
        items: [
          'Job types and workplaces: Büro, Fabrik, Schule, Krankenhaus',
          'Work activities: telefonieren, schreiben, planen, leiten',
          'Work schedule: Teilzeit, Vollzeit, Schicht, Urlaub',
          'Applying for a job: Bewerbung, Lebenslauf, Vorstellungsgespräch',
          'Colleagues and hierarchy: Chef, Kollege, Abteilung, Besprechung',
        ],
        grammar: [
          { rule: 'Simple past (Präteritum) of sein & haben: war, hatte', id: 'a2-g1' },
          { rule: 'Present perfect (Perfekt): Ich habe gearbeitet / bin gegangen', id: 'a2-g2' },
          { rule: 'Separable verbs in Perfekt: Ich habe angerufen', id: 'a2-g3' },
          { rule: 'Modal verbs in past: musste, konnte, durfte', id: 'a2-g4' },
        ],
      },
      {
        id: 'a2-leisure',
        title: 'Leisure & Free Time',
        icon: '⚽',
        color: 'text-green-400 bg-green-500/10 border-green-400/20',
        vocabTopic: 'leisure and hobbies',
        items: [
          'Sports: schwimmen, Fußball spielen, joggen, Fahrrad fahren',
          'Culture: ins Kino gehen, Konzerte, Theater, Museen',
          'Media: fernsehen, im Internet surfen, Social Media',
          'Making plans: Hast du Lust? Ich schlage vor…, Wollen wir…?',
          'Weather: sonnig, bewölkt, regnerisch, warm, kalt',
        ],
        grammar: [
          { rule: 'Conjunctions: weil (because), dass (that), wenn (when/if)', id: 'a2-g5' },
          { rule: 'Word order in subordinate clauses: verb goes to end', id: 'a2-g6' },
          { rule: 'Two-way prepositions: in/an/auf + Dative vs Accusative', id: 'a2-g7' },
          { rule: 'Comparative: größer, besser, schneller als', id: 'a2-g8' },
        ],
      },
      {
        id: 'a2-shopping',
        title: 'Shopping & Services',
        icon: '🛍️',
        color: 'text-pink-400 bg-pink-500/10 border-pink-400/20',
        vocabTopic: 'shopping and services',
        items: [
          'Clothes and sizes: Hemd, Hose, Schuhe, Größe, Farbe',
          'Comparing items: teurer, billiger, besser, schlechter',
          'Shops and services: Bäckerei, Apotheke, Bank, Post',
          'Payment methods: bar, Kreditkarte, überweisen',
          'Complaints and returns: umtauschen, Quittung, kaputt',
        ],
        grammar: [
          { rule: 'Adjective declension (Nominative, Accusative, Dative)', id: 'a2-g9' },
          { rule: 'Demonstratives: dieser/diese/dieses, welcher/welche/welches', id: 'a2-g10' },
          { rule: 'Genitive s: Annas Buch, Peters Auto', id: 'a2-g11' },
          { rule: 'Indirect questions: Können Sie mir sagen, wo…?', id: 'a2-g12' },
        ],
      },
      {
        id: 'a2-housing',
        title: 'Housing & Neighbourhood',
        icon: '🏘️',
        color: 'text-cyan-400 bg-cyan-500/10 border-cyan-400/20',
        vocabTopic: 'housing and home',
        items: [
          'Describing a flat: Zimmer, Etage, Quadratmeter, Miete',
          'Furniture: Tisch, Stuhl, Bett, Schrank, Sofa',
          'Neighbourhood: Supermarkt, Park, Schule, Haltestelle',
          'Renting: Mietvertrag, Kaution, Vermieter, Nebenkosten',
          'Repairs: reparieren, kaputt, funktioniert nicht, der Handwerker',
        ],
        grammar: [
          { rule: 'Local adverbs: hier, dort, oben, unten, vorne, hinten', id: 'a2-g13' },
          { rule: 'Prepositions with Dative: bei, mit, nach, seit, von, zu', id: 'a2-g14' },
          { rule: 'Es gibt + Accusative: Es gibt einen Park', id: 'a2-g15' },
          { rule: 'Reflexive verbs: sich vorstellen, sich befinden', id: 'a2-g16' },
        ],
      },
      {
        id: 'a2-travel',
        title: 'Travel & Transport',
        icon: '✈️',
        color: 'text-yellow-400 bg-yellow-500/10 border-yellow-400/20',
        vocabTopic: 'travel in Germany',
        items: [
          'Booking travel: reservieren, buchen, stornieren',
          'At the station/airport: Gleis, Abflug, Ankunft, Verspätung',
          'Accommodation: Hotel, Jugendherberge, Pension, einchecken',
          'Sightseeing: Sehenswürdigkeiten, Stadtführung, Eintritt',
          'Problems: verloren, verpassen, umsteigen, Anschluss',
        ],
        grammar: [
          { rule: 'Future with werden: Ich werde fahren', id: 'a2-g17' },
          { rule: 'Future with present + time expression: Ich fahre morgen', id: 'a2-g18' },
          { rule: 'Superlative: am schnellsten, der beste, das größte', id: 'a2-g19' },
          { rule: 'Temporal conjunctions: bevor, nachdem, während', id: 'a2-g20' },
        ],
      },
      {
        id: 'a2-health',
        title: 'Health & Wellbeing',
        icon: '💊',
        color: 'text-red-400 bg-red-500/10 border-red-400/20',
        vocabTopic: 'health and medicine',
        items: [
          'Symptoms: Schmerzen, Husten, Fieber, Schwindel, Allergie',
          'Medical appointments: Termin, Überweisung, Versicherungskarte',
          'Healthy lifestyle: Sport treiben, gesund essen, Stress vermeiden',
          'Pharmacy: Tabletten, Tropfen, Salbe, verschreibungspflichtig',
          'Hospital: stationär, Operation, Notaufnahme, Krankenwagen',
        ],
        grammar: [
          { rule: 'Passive voice (basic): Das Medikament wird verschrieben', id: 'a2-g21' },
          { rule: 'Modal verb sollen: Du sollst viel trinken', id: 'a2-g22' },
          { rule: 'Subjunctive II (Konjunktiv II): Ich würde…, ich könnte…', id: 'a2-g23' },
          { rule: 'Infinitive constructions: um … zu, ohne … zu', id: 'a2-g24' },
        ],
      },
    ],
    examTips: [
      { tip: 'Hören: You hear each audio twice. Use the first listen to get the gist.', icon: '🎧' },
      { tip: 'Lesen: Match keywords in questions to words in the text. Don\'t translate everything.', icon: '👁️' },
      { tip: 'Schreiben: Structure your reply: greeting → content → closing. Aim for 60–80 words.', icon: '✍️' },
      { tip: 'Sprechen: Use connectors: erstens, dann, außerdem, weil — they boost your score.', icon: '🗣️' },
      { tip: 'Perfekt vs Präteritum: In speech use Perfekt. In writing both are fine.', icon: '📝' },
      { tip: 'If you don\'t know a word, describe it: "Das Ding, das man benutzt, um…"', icon: '💡' },
    ],
  },
}

// ─── Types ─────────────────────────────────────────────────────────────────────

type Level = 'A1' | 'A2'

interface Progress {
  completedTopics: string[]
  completedGrammar: string[]
}

// ─── Component ─────────────────────────────────────────────────────────────────

export default function SyllabusPage() {
  const user = useAppSelector(s => s.auth.user)
  const [level, setLevel]       = useState<Level>('A1')
  const [expandedTopic, setExpanded] = useState<string | null>(null)
  const [progress, setProgress] = useState<Progress>({ completedTopics: [], completedGrammar: [] })
  const [saving, setSaving]     = useState(false)

  const syllabus = SYLLABUS[level]

  // Load progress from API
  useEffect(() => {
    api.get(`/syllabus/progress/${level}`)
      .then(r => setProgress(r.data.progress || { completedTopics: [], completedGrammar: [] }))
      .catch(() => {
        // Fallback to localStorage if API not ready
        const saved = localStorage.getItem(`syllabus-progress-${level}`)
        if (saved) setProgress(JSON.parse(saved))
      })
  }, [level])

  const saveProgress = async (updated: Progress) => {
    setSaving(true)
    try {
      await api.post(`/syllabus/progress/${level}`, updated)
    } catch {
      localStorage.setItem(`syllabus-progress-${level}`, JSON.stringify(updated))
    }
    setSaving(false)
  }

  const toggleTopic = async (topicId: string) => {
    const updated = { ...progress }
    if (updated.completedTopics.includes(topicId)) {
      updated.completedTopics = updated.completedTopics.filter(t => t !== topicId)
    } else {
      updated.completedTopics = [...updated.completedTopics, topicId]
    }
    setProgress(updated)
    await saveProgress(updated)
  }

  const toggleGrammar = async (grammarId: string) => {
    const updated = { ...progress }
    if (updated.completedGrammar.includes(grammarId)) {
      updated.completedGrammar = updated.completedGrammar.filter(g => g !== grammarId)
    } else {
      updated.completedGrammar = [...updated.completedGrammar, grammarId]
    }
    setProgress(updated)
    await saveProgress(updated)
  }

  // Stats
  const totalTopics   = syllabus.topics.length
  const doneTopics    = syllabus.topics.filter(t => progress.completedTopics.includes(t.id)).length
  const totalGrammar  = syllabus.topics.reduce((s, t) => s + t.grammar.length, 0)
  const doneGrammar   = progress.completedGrammar.filter(g => g.startsWith(level.toLowerCase())).length
  const overallPct    = Math.round(((doneTopics / totalTopics) * 0.5 + (doneGrammar / totalGrammar) * 0.5) * 100)

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto animate-fade-in">

      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <Trophy size={20} className="text-gold"/>
          <h1 className="font-display text-2xl sm:text-3xl text-gray-800">Goethe Exam Prep</h1>
        </div>
        <p className="text-gray-500 text-sm">Structured syllabus for Goethe-Zertifikat A1 & A2 — track your progress topic by topic</p>
      </div>

      {/* Level switcher */}
      <div className="flex gap-2 mb-6">
        {(['A1', 'A2'] as Level[]).map(l => (
          <button key={l} onClick={() => setLevel(l)}
            className={`flex-1 sm:flex-none px-6 py-3 rounded-xl border font-display text-lg transition-all
              ${level === l
                ? 'bg-gold/10 border-gold/40 text-gold shadow-[0_0_20px_rgba(200,169,110,0.1)]'
                : 'bg-ink-800 border-white/[0.07] text-gray-400 hover:text-gray-700 hover:border-white/15'}`}>
            {l}
          </button>
        ))}
      </div>

      {/* Level overview card */}
      <div className="card mb-5">
        <div className="flex flex-col sm:flex-row sm:items-start gap-4">
          <div className="flex-1">
            <h2 className="font-display text-xl text-gray-800">{syllabus.title}</h2>
            <p className="text-gold text-sm mb-2">{syllabus.subtitle}</p>
            <p className="text-gray-400 text-sm leading-relaxed">{syllabus.description}</p>
          </div>
          {/* Overall progress ring */}
          <div className="flex flex-col items-center shrink-0">
            <div className="relative w-20 h-20">
              <svg className="w-20 h-20 -rotate-90" viewBox="0 0 36 36">
                <circle cx="18" cy="18" r="15.9" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="3"/>
                <circle cx="18" cy="18" r="15.9" fill="none" stroke="#c8a96e" strokeWidth="3"
                  strokeDasharray={`${overallPct} ${100 - overallPct}`}
                  strokeLinecap="round" className="transition-all duration-700"/>
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="font-display text-xl text-gold">{overallPct}%</span>
              </div>
            </div>
            <p className="text-[10px] text-gray-500 mt-1 text-center">Overall<br/>Progress</p>
          </div>
        </div>

        {/* Mini stats */}
        <div className="grid grid-cols-3 gap-2 mt-4 pt-4 border-t border-white/[0.06]">
          {[
            { label: 'Topics',   value: `${doneTopics}/${totalTopics}`,  color: 'text-teal-soft' },
            { label: 'Grammar',  value: `${doneGrammar}/${totalGrammar}`, color: 'text-violet-soft' },
            { label: 'Exam Date', value: 'Set goal', color: 'text-gold' },
          ].map(s => (
            <div key={s.label} className="text-center">
              <p className={`font-display text-xl ${s.color}`}>{s.value}</p>
              <p className="text-[10px] text-gray-600">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Exam Format */}
      <div className="card mb-5">
        <h3 className="section-label flex items-center gap-2"><Target size={13}/> Exam Format</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {syllabus.examFormat.map(f => (
            <div key={f.skill} className="bg-ink-800 rounded-xl p-3 border border-white/[0.06]">
              <div className="text-2xl mb-1.5">{f.icon}</div>
              <p className="font-medium text-gray-800 text-sm">{f.skill}</p>
              <p className="text-xs text-gold">{f.duration} · {f.parts} parts</p>
              <p className="text-[10px] text-gray-500 mt-1.5 leading-relaxed">{f.description}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Topics */}
      <div className="mb-5">
        <h3 className="section-label flex items-center gap-2"><BookOpen size={13}/> Topics & Vocabulary</h3>
        <div className="space-y-2">
          {syllabus.topics.map(topic => {
            const isExpanded   = expandedTopic === topic.id
            const isDone       = progress.completedTopics.includes(topic.id)
            const grammarDone  = topic.grammar.filter(g => progress.completedGrammar.includes(g.id)).length
            const grammarTotal = topic.grammar.length
            const topicPct     = Math.round(((isDone ? 1 : 0) * 0.4 + (grammarDone / grammarTotal) * 0.6) * 100)

            return (
              <div key={topic.id}
                className={`rounded-2xl border transition-all overflow-hidden
                  ${isDone ? 'border-teal-soft/20 bg-teal-muted/30' : 'border-white/[0.07] bg-ink-900'}`}>

                {/* Topic header */}
                <div className="flex items-center gap-3 p-4 cursor-pointer"
                  onClick={() => setExpanded(isExpanded ? null : topic.id)}>
                  <button
                    onClick={e => { e.stopPropagation(); toggleTopic(topic.id) }}
                    className="shrink-0 transition-colors">
                    {isDone
                      ? <CheckCircle2 size={20} className="text-teal-soft"/>
                      : <Circle size={20} className="text-gray-600 hover:text-gray-400"/>}
                  </button>
                  <span className="text-xl shrink-0">{topic.icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className={`font-medium text-sm ${isDone ? 'text-teal-soft' : 'text-gray-700'}`}>
                      {topic.title}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <div className="flex-1 max-w-[80px] h-1 bg-ink-700 rounded-full overflow-hidden">
                        <div className="h-full bg-gold rounded-full transition-all"
                          style={{ width: `${topicPct}%` }}/>
                      </div>
                      <span className="text-[10px] text-gray-600">{grammarDone}/{grammarTotal} grammar</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Link
                      to={`/vocab?topic=${encodeURIComponent(topic.vocabTopic)}`}
                      onClick={e => e.stopPropagation()}
                      className="btn-ghost text-[10px] px-2 py-1 gap-1 text-gray-600 hover:text-gold">
                      <Zap size={10}/> Vocab
                    </Link>
                    {isExpanded ? <ChevronUp size={16} className="text-gray-500"/> : <ChevronDown size={16} className="text-gray-500"/>}
                  </div>
                </div>

                {/* Expanded content */}
                {isExpanded && (
                  <div className="px-4 pb-4 border-t border-white/[0.06] pt-4 space-y-4 animate-fade-in">
                    <div className="grid sm:grid-cols-2 gap-4">

                      {/* Vocabulary topics */}
                      <div>
                        <p className="text-[10px] text-gray-500 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                          <BookOpen size={10}/> Key Vocabulary
                        </p>
                        <ul className="space-y-1.5">
                          {topic.items.map((item, i) => (
                            <li key={i} className="flex items-start gap-2 text-xs text-gray-600">
                              <span className="text-gold mt-0.5 shrink-0">•</span>
                              {item}
                            </li>
                          ))}
                        </ul>
                        <Link
                          to="/vocab"
                          className={`mt-3 flex items-center gap-1.5 text-xs px-3 py-2 rounded-xl border transition-all
                            ${topic.color} w-full justify-center`}>
                          <Zap size={12}/> Generate "{topic.vocabTopic}" vocab list
                          <ArrowRight size={11}/>
                        </Link>
                      </div>

                      {/* Grammar checklist */}
                      <div>
                        <p className="text-[10px] text-gray-500 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                          <PenLine size={10}/> Grammar Checklist
                        </p>
                        <div className="space-y-2">
                          {topic.grammar.map(g => {
                            const gDone = progress.completedGrammar.includes(g.id)
                            return (
                              <button key={g.id}
                                onClick={() => toggleGrammar(g.id)}
                                className={`w-full flex items-start gap-2 text-left text-xs p-2.5 rounded-xl border transition-all
                                  ${gDone
                                    ? 'bg-teal-muted border-teal-soft/20 text-teal-soft'
                                    : 'bg-ink-800 border-white/[0.06] text-gray-400 hover:border-white/15'}`}>
                                {gDone
                                  ? <CheckCircle2 size={13} className="text-teal-soft shrink-0 mt-0.5"/>
                                  : <Circle size={13} className="shrink-0 mt-0.5"/>}
                                <span className="leading-relaxed">{g.rule}</span>
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    </div>

                    {/* Quick links to practise */}
                    <div className="pt-2 border-t border-white/[0.06]">
                      <p className="text-[10px] text-gray-600 mb-2">Practise this topic:</p>
                      <div className="flex gap-2 flex-wrap">
                        <Link to="/writing"    className="btn-ghost text-xs gap-1.5 py-1.5 px-3"><PenLine size={12}/> Writing</Link>
                        <Link to="/chat"       className="btn-ghost text-xs gap-1.5 py-1.5 px-3"><Mic size={12}/> Conversation</Link>
                        <Link to="/translate"  className="btn-ghost text-xs gap-1.5 py-1.5 px-3"><FileText size={12}/> Translate</Link>
                        <Link to="/flashcards" className="btn-ghost text-xs gap-1.5 py-1.5 px-3"><Star size={12}/> Flashcards</Link>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Exam skills practice links */}
      <div className="card mb-5">
        <h3 className="section-label">Practise Exam Skills</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {[
            { label: 'Hören',    icon: <Headphones size={18}/>, to: '/read-aloud', color: 'text-gold',        bg: 'bg-gold/10',        desc: 'Listen at exam speed' },
            { label: 'Lesen',    icon: <FileText size={18}/>,   to: '/read-aloud', color: 'text-teal-soft',   bg: 'bg-teal-muted',     desc: 'Read & translate' },
            { label: 'Schreiben',icon: <PenLine size={18}/>,    to: '/writing',    color: 'text-violet-soft', bg: 'bg-violet-muted',   desc: 'Write & get corrected' },
            { label: 'Sprechen', icon: <Mic size={18}/>,        to: '/coach',      color: 'text-orange-400',  bg: 'bg-orange-500/10',  desc: 'Record & get feedback' },
          ].map(s => (
            <Link key={s.label} to={s.to}
              className={`flex flex-col items-center gap-2 p-4 rounded-xl border border-white/[0.07] hover:border-white/15 transition-all ${s.bg}`}>
              <div className={s.color}>{s.icon}</div>
              <p className={`font-medium text-xs ${s.color}`}>{s.label}</p>
              <p className="text-[10px] text-gray-500 text-center">{s.desc}</p>
            </Link>
          ))}
        </div>
      </div>

      {/* Exam tips */}
      <div className="card">
        <h3 className="section-label flex items-center gap-2"><Star size={13}/> Exam Day Tips</h3>
        <div className="space-y-2">
          {syllabus.examTips.map((t, i) => (
            <div key={i} className="flex items-start gap-3 p-3 bg-ink-800 rounded-xl border border-white/[0.05]">
              <span className="text-lg shrink-0">{t.icon}</span>
              <p className="text-sm text-gray-600 leading-relaxed">{t.tip}</p>
            </div>
          ))}
        </div>
      </div>

      {saving && (
        <div className="fixed bottom-4 right-4 bg-ink-800 border border-white/10 rounded-xl px-4 py-2 text-xs text-gray-400 flex items-center gap-2">
          <div className="spinner w-3 h-3"/> Saving progress…
        </div>
      )}
    </div>
  )
}
