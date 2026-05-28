import { useState, useRef, useEffect } from 'react'
import { toast } from 'react-toastify'
import { useAppDispatch, useAppSelector } from '../hooks/redux'
import { generatePodcast, uploadMaterial, fetchMaterials, setStyle } from '../store/slices/podcastSlice'
import { Upload, Mic2, Play, Square, Copy } from 'lucide-react'

const styles = ['educational', 'conversational', 'storytelling']

export default function PodcastPage() {
  const dispatch = useAppDispatch()
  const { script, style, materials, loading, uploading, error } = useAppSelector(s => s.podcast)
  const [customText, setCustomText] = useState('')
  const [selectedMat, setSelectedMat] = useState('')
  const [speaking, setSpeaking] = useState(false)
  const [dragover, setDragover] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => { dispatch(fetchMaterials()) }, [dispatch])
  useEffect(() => { if (error) toast.error(error) }, [error])

  const handleFileUpload = async (file: File | null | undefined) => {
    if (!file) return
    const fd = new FormData()
    fd.append('file', file)
    fd.append('title', file.name.replace(/\.[^/.]+$/, ''))
    const result = await dispatch(uploadMaterial(fd))
    if (!result.error) {
      toast.success('File uploaded ✅')
      setSelectedMat((result.payload as { material: { _id: string } }).material._id)
    }
  }

  const handleGenerate = async () => {
    if (!selectedMat && !customText.trim()) return toast.error('Upload a file or enter some text first')
    const result = await dispatch(generatePodcast({ materialId: selectedMat || undefined, style, customText: customText || undefined }))
    if (!result.error) toast.success('Podcast script ready! 🎙️')
  }

  const handleSpeak = () => {
    if (!script) return
    speechSynthesis.cancel()
    const u = new SpeechSynthesisUtterance(script)
    u.lang = 'en-US'; u.rate = 0.92
    u.onend = () => setSpeaking(false)
    speechSynthesis.speak(u); setSpeaking(true)
  }
  const handleStop = () => { speechSynthesis.cancel(); setSpeaking(false) }
  const handleCopy = () => { navigator.clipboard.writeText(script); toast.success('Copied!') }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-3xl mx-auto animate-fade-in">
      <div className="mb-5">
        <h1 className="font-display text-2xl sm:text-3xl text-gray-800">File to Podcast</h1>
        <p className="text-gray-500 text-sm mt-1">Upload learning material → get an AI podcast script</p>
      </div>

      <div className={`card mb-4 border-dashed border-2 cursor-pointer transition-all text-center py-8 sm:py-10
          ${dragover ? 'border-teal-soft/60 bg-teal-muted' : 'border-white/10 hover:border-gold/30 hover:bg-gold/5'}`}
        onClick={() => fileRef.current?.click()}
        onDragOver={e => { e.preventDefault(); setDragover(true) }}
        onDragLeave={() => setDragover(false)}
        onDrop={e => { e.preventDefault(); setDragover(false); handleFileUpload(e.dataTransfer.files[0]) }}>
        <Upload size={28} className="text-gray-600 mx-auto mb-3"/>
        <p className="text-gray-600 font-medium text-sm">{uploading ? 'Uploading…' : 'Drop PDF, PPTX, DOCX or TXT here'}</p>
        <p className="text-gray-600 text-xs mt-1">or tap to browse</p>
        <input ref={fileRef} type="file" accept=".pdf,.pptx,.docx,.doc,.txt,application/pdf,application/vnd.openxmlformats-officedocument.presentationml.presentation,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain" className="hidden"
          onChange={e => handleFileUpload(e.target.files?.[0])}/>
      </div>

      {materials.length > 0 && (
        <div className="mb-4">
          <label className="section-label">Select uploaded file</label>
          <select className="input" value={selectedMat} onChange={e => setSelectedMat(e.target.value)}>
            <option value="">— None —</option>
            {materials.map(m => <option key={m._id} value={m._id}>{m.title} ({m.fileType})</option>)}
          </select>
        </div>
      )}

      <div className="mb-4">
        <label className="section-label">Or paste custom text</label>
        <textarea className="textarea" rows={4} placeholder="Paste text to convert into a podcast lesson…"
          value={customText} onChange={e => setCustomText(e.target.value)}/>
      </div>

      <div className="mb-5">
        <label className="section-label">Podcast Style</label>
        <div className="flex gap-2 flex-wrap">
          {styles.map(s => (
            <button key={s} onClick={() => dispatch(setStyle(s))}
              className={`btn-secondary capitalize flex-1 sm:flex-none ${style === s ? 'border-gold/50 text-gold bg-gold/5' : ''}`}>
              {s === 'educational' ? '🎓' : s === 'conversational' ? '💬' : '📖'} {s}
            </button>
          ))}
        </div>
      </div>

      <button onClick={handleGenerate} className="btn-primary w-full sm:w-auto justify-center" disabled={loading}>
        {loading ? <span className="spinner"/> : <Mic2 size={16}/>}
        {loading ? 'Generating…' : 'Generate Podcast Script'}
      </button>

      {script && (
        <div className="mt-6 card animate-slide-up">
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <h3 className="font-medium text-gray-700 flex items-center gap-2"><Mic2 size={16} className="text-gold"/> Podcast Script</h3>
            <div className="flex gap-2">
              {speaking
                ? <button onClick={handleStop} className="btn-ghost text-red-400"><Square size={14}/> Stop</button>
                : <button onClick={handleSpeak} className="btn-ghost"><Play size={14}/> Listen</button>}
              <button onClick={handleCopy} className="btn-ghost"><Copy size={14}/> Copy</button>
            </div>
          </div>
          <div className="bg-ink-800 rounded-xl p-4 text-sm text-gray-600 leading-relaxed whitespace-pre-wrap max-h-96 overflow-y-auto">{script}</div>
        </div>
      )}
    </div>
  )
}
