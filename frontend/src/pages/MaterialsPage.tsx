import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'react-toastify'
import { useAppDispatch, useAppSelector } from '../hooks/redux'
import { fetchMaterials, uploadMaterial, deleteMaterial } from '../store/slices/podcastSlice'
import api from '../utils/api'
import {
  Upload, FileText, Trash2, Mic2, Headphones,
  RefreshCw, CheckCircle2, AlertCircle, Loader2,
  FileWarning, Info,
} from 'lucide-react'
import type { Material } from '../types'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const FILE_ICONS: Record<string, string> = {
  pdf: '📄', pptx: '📊', docx: '📝', doc: '📝', txt: '📃',
}
const FORMAT_COLORS: Record<string, string> = {
  pdf:  'bg-red-500/10 text-red-400 border-red-400/20',
  pptx: 'bg-orange-500/10 text-orange-400 border-orange-400/20',
  docx: 'bg-blue-500/10 text-blue-400 border-blue-400/20',
  doc:  'bg-blue-500/10 text-blue-400 border-blue-400/20',
  txt:  'bg-gray-500/10 text-gray-400 border-gray-400/20',
}

function fileIcon(type: string)  { return FILE_ICONS[(type||'').toLowerCase()] || '📎' }
function formatColor(type: string) { return FORMAT_COLORS[(type||'').toLowerCase()] || 'bg-ink-700 text-gray-400 border-white/10' }
function fileSize(bytes: number) {
  if (!bytes) return '—'
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

const ACCEPTED = '.pdf,.pptx,.docx,.doc,.txt,application/pdf,application/vnd.openxmlformats-officedocument.presentationml.presentation,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain'

// ─── Component ────────────────────────────────────────────────────────────────

export default function MaterialsPage() {
  const dispatch  = useAppDispatch()
  const navigate  = useNavigate()
  const { materials, uploading } = useAppSelector(s => s.podcast)

  const [dragover,     setDragover]     = useState(false)
  const [deletingId,   setDeletingId]   = useState<string | null>(null)
  const [extractingId, setExtractingId] = useState<string | null>(null)
  const [previewId,    setPreviewId]    = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => { dispatch(fetchMaterials()) }, [dispatch])

  // ── Upload ──────────────────────────────────────────────────────────────────

  const handleFiles = async (files: FileList | null) => {
    if (!files?.length) return
    const allowed = /\.(pdf|pptx|docx|doc|txt)$/i

    for (const file of Array.from(files)) {
      if (!allowed.test(file.name)) {
        toast.error(`${file.name} — unsupported format. Use PDF, PPTX, DOCX or TXT.`)
        continue
      }
      if (file.size > 20 * 1024 * 1024) {
        toast.error(`${file.name} is too large. Max file size is 20 MB.`)
        continue
      }
      const fd = new FormData()
      fd.append('file', file)
      fd.append('title', file.name.replace(/\.[^/.]+$/, ''))
      const result = await dispatch(uploadMaterial(fd))
      if (!result.error) {
        toast.success(`"${file.name}" uploaded ✅`)
      } else {
        toast.error(`Upload failed: ${result.payload}`)
      }
    }
    dispatch(fetchMaterials())
  }

  // ── Delete ──────────────────────────────────────────────────────────────────

  const handleDelete = async (mat: Material) => {
    if (!confirm(`Delete "${mat.title}"? This cannot be undone.`)) return
    setDeletingId(mat._id)
    const result = await dispatch(deleteMaterial(mat._id))
    setDeletingId(null)
    if (!result.error) toast.success('File deleted')
    else toast.error('Delete failed')
  }

  // ── Re-extract text ─────────────────────────────────────────────────────────

  const handleReextract = async (mat: Material) => {
    setExtractingId(mat._id)
    try {
      const res = await api.post(`/upload/${mat._id}/extract`)
      if (res.data.success) {
        toast.success(`Text extracted — ${res.data.length} characters`)
        dispatch(fetchMaterials())
      } else {
        toast.error(res.data.message || 'Extraction failed')
      }
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } }
      toast.error(e?.response?.data?.message || 'Extraction failed')
    }
    setExtractingId(null)
  }

  // ── Stats ───────────────────────────────────────────────────────────────────

  const totalFiles  = materials.length
  const readyFiles  = materials.filter(m => m.hasText).length
  const totalSizeKB = materials.reduce((s, m) => s + (m.fileSize || 0), 0) / 1024

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto animate-fade-in">

      {/* Header */}
      <div className="mb-6">
        <h1 className="font-display text-2xl sm:text-3xl text-gray-800">My Materials</h1>
        <p className="text-gray-500 text-sm mt-1">
          Upload PDFs, PowerPoints, Word docs and text files — then read, listen or practise with them
        </p>
      </div>

      {/* Stats row */}
      {totalFiles > 0 && (
        <div className="grid grid-cols-3 gap-2 sm:gap-3 mb-6">
          {[
            { label: 'Files',          value: totalFiles,                    color: 'text-gray-800' },
            { label: 'Text Ready',     value: `${readyFiles}/${totalFiles}`, color: 'text-teal-soft' },
            { label: 'Storage',        value: `${totalSizeKB < 1024 ? totalSizeKB.toFixed(0) + ' KB' : (totalSizeKB/1024).toFixed(1) + ' MB'}`, color: 'text-gray-400' },
          ].map(s => (
            <div key={s.label} className="card-sm text-center">
              <p className={`font-display text-2xl ${s.color}`}>{s.value}</p>
              <p className="text-[10px] text-gray-600 mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Upload zone */}
      <div
        className={`card border-dashed border-2 mb-6 cursor-pointer transition-all text-center py-10 sm:py-12
          ${dragover ? 'border-teal-soft/60 bg-teal-muted' : 'border-white/10 hover:border-gold/30 hover:bg-gold/[0.03]'}`}
        onClick={() => fileRef.current?.click()}
        onDragOver={e => { e.preventDefault(); setDragover(true) }}
        onDragLeave={() => setDragover(false)}
        onDrop={e => { e.preventDefault(); setDragover(false); handleFiles(e.dataTransfer.files) }}
      >
        {uploading ? (
          <div className="flex flex-col items-center gap-3">
            <Loader2 size={36} className="text-gold animate-spin"/>
            <p className="text-gray-600 font-medium">Uploading…</p>
          </div>
        ) : (
          <>
            <Upload size={36} className="text-gray-600 mx-auto mb-3"/>
            <p className="text-gray-700 font-medium mb-1">Drop files here or tap to browse</p>
            <p className="text-gray-500 text-sm">PDF · PPTX · DOCX · TXT — up to 20 MB each</p>
            <div className="flex justify-center gap-2 mt-4 flex-wrap">
              {['📄 PDF','📊 PPTX','📝 DOCX','📃 TXT'].map(f => (
                <span key={f} className="text-xs px-3 py-1.5 bg-ink-800 border border-white/[0.06] rounded-full text-gray-500">{f}</span>
              ))}
            </div>
          </>
        )}
        <input ref={fileRef} type="file" multiple accept={ACCEPTED} className="hidden"
          onChange={e => handleFiles(e.target.files)}/>
      </div>

      {/* Info banner */}
      <div className="flex gap-2.5 p-3 bg-ink-800 border border-white/[0.06] rounded-xl mb-5 text-xs text-gray-500">
        <Info size={13} className="text-gold shrink-0 mt-0.5"/>
        <p>
          <span className="text-gray-600">Text extraction</span> happens automatically after upload (within seconds).
          Text-based PDFs and PPTX/DOCX work best. Scanned or image-only PDFs cannot be read — paste the text manually instead.
        </p>
      </div>

      {/* File list */}
      {materials.length === 0 ? (
        <div className="card text-center py-16">
          <FileText size={48} className="text-gray-700 mx-auto mb-4"/>
          <p className="text-gray-400 font-medium mb-1">No files uploaded yet</p>
          <p className="text-gray-600 text-sm">Upload a PDF, PPTX, DOCX or TXT file to get started</p>
        </div>
      ) : (
        <div className="space-y-2">
          {materials.map((mat: Material) => {
            const isDeleting   = deletingId   === mat._id
            const isExtracting = extractingId === mat._id
            const isPreview    = previewId    === mat._id

            return (
              <div key={mat._id}
                className={`card transition-all ${isDeleting ? 'opacity-50' : ''}`}>

                {/* Top row: icon + title + format badge + status */}
                <div className="flex items-start gap-3">
                  <span className="text-2xl shrink-0 mt-0.5">{fileIcon(mat.fileType)}</span>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium text-gray-800 text-sm truncate max-w-[200px] sm:max-w-xs">
                        {mat.title}
                      </p>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full border font-mono uppercase ${formatColor(mat.fileType)}`}>
                        {mat.fileType}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                      <span className="text-xs text-gray-600">{fileSize(mat.fileSize)}</span>
                      <span className="text-gray-700">·</span>
                      <span className="text-xs text-gray-600">
                        {new Date(mat.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </span>

                      {/* Extraction status */}
                      {mat.hasText ? (
                        <span className="flex items-center gap-1 text-[10px] text-teal-soft">
                          <CheckCircle2 size={10}/> Text ready
                        </span>
                      ) : isExtracting ? (
                        <span className="flex items-center gap-1 text-[10px] text-gold animate-pulse">
                          <Loader2 size={10} className="animate-spin"/> Extracting…
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-[10px] text-amber-500/80">
                          <FileWarning size={10}/> Not extracted
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Action buttons */}
                <div className="flex gap-1.5 mt-3 flex-wrap">
                  {/* Read Aloud */}
                  <button
                    onClick={() => navigate('/read-aloud', { state: { materialId: mat._id } })}
                    className="btn-secondary flex-1 sm:flex-none text-xs justify-center py-2 gap-1.5 min-w-0">
                    <Headphones size={13}/> <span className="truncate">Read Aloud</span>
                  </button>

                  {/* Podcast */}
                  <button
                    onClick={() => navigate('/podcast', { state: { materialId: mat._id } })}
                    className="btn-secondary flex-1 sm:flex-none text-xs justify-center py-2 gap-1.5 min-w-0">
                    <Mic2 size={13}/> <span className="truncate">Podcast</span>
                  </button>

                  {/* Re-extract */}
                  {!mat.hasText && (
                    <button
                      onClick={() => handleReextract(mat)}
                      disabled={!!extractingId}
                      className="btn-secondary flex-1 sm:flex-none text-xs justify-center py-2 gap-1.5 min-w-0 text-gold border-gold/30 hover:bg-gold/10">
                      {isExtracting
                        ? <><Loader2 size={12} className="animate-spin"/> Extracting…</>
                        : <><RefreshCw size={12}/> Extract text</>}
                    </button>
                  )}

                  {/* Delete */}
                  <button
                    onClick={() => handleDelete(mat)}
                    disabled={isDeleting || !!deletingId}
                    className="btn-secondary sm:flex-none text-xs justify-center py-2 px-3 text-red-400 border-red-400/20 hover:bg-red-500/10">
                    {isDeleting ? <Loader2 size={13} className="animate-spin"/> : <Trash2 size={13}/>}
                  </button>
                </div>

                {/* Extracted text preview (collapsible) */}
                {mat.hasText && (
                  <div className="mt-2.5">
                    <button onClick={() => setPreviewId(isPreview ? null : mat._id)}
                      className="text-[10px] text-gray-600 hover:text-gray-400 transition-colors flex items-center gap-1">
                      <AlertCircle size={10}/>
                      {isPreview ? 'Hide preview' : 'Preview extracted text'}
                    </button>
                    {isPreview && (
                      <div className="mt-2 bg-ink-800 rounded-xl p-3 text-xs text-gray-400 leading-relaxed
                        max-h-32 overflow-y-auto border border-white/[0.05] font-mono">
                        {/* We'd need to fetch the full doc — just show a note */}
                        Text has been extracted and is ready for AI processing. Click "Read Aloud" or "Podcast" to use it.
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
