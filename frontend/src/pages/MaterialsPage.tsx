import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'react-toastify'
import { useAppDispatch, useAppSelector } from '../hooks/redux'
import { fetchMaterials, uploadMaterial, deleteMaterial } from '../store/slices/podcastSlice'
import {
  Upload, FileText, File, Trash2, BookOpen, Mic2, ExternalLink,
  CloudUpload, Search, ChevronDown, ChevronUp, Calendar, HardDrive,
} from 'lucide-react'

const FILE_ICONS: Record<string, React.ElementType> = {
  pdf: FileText,
  txt: FileText,
  docx: File,
  pptx: File,
}

const FILE_COLORS: Record<string, string> = {
  pdf:  'text-red-400 bg-red-500/10',
  txt:  'text-blue-400 bg-blue-500/10',
  docx: 'text-blue-500 bg-blue-500/10',
  pptx: 'text-orange-400 bg-orange-500/10',
}

function formatSize(bytes: number) {
  if (!bytes) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function MaterialsPage() {
  const dispatch   = useAppDispatch()
  const navigate   = useNavigate()
  const { materials, uploading } = useAppSelector(s => s.podcast)

  const fileRef  = useRef<HTMLInputElement>(null)
  const [dragover, setDragover] = useState(false)
  const [search,   setSearch]   = useState('')
  const [sortBy,   setSortBy]   = useState<'date' | 'name' | 'size'>('date')
  const [sortAsc,  setSortAsc]  = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)

  useEffect(() => { dispatch(fetchMaterials()) }, [dispatch])

  const handleUpload = async (file: File | null | undefined) => {
    if (!file) return
    const fd = new FormData()
    fd.append('file', file)
    fd.append('title', file.name.replace(/\.[^/.]+$/, ''))
    const result = await dispatch(uploadMaterial(fd))
    if (!('error' in result)) toast.success(`"${file.name}" uploaded ✅`)
    else toast.error(String((result as any).payload))
  }

  const handleDelete = async (id: string, title: string) => {
    if (!window.confirm(`Delete "${title}"? This cannot be undone.`)) return
    setDeleting(id)
    const result = await dispatch(deleteMaterial(id))
    setDeleting(null)
    if (!('error' in result)) toast.success('Material deleted')
    else toast.error('Could not delete material')
  }

  // Filter + sort
  const filtered = materials
    .filter(m => m.title.toLowerCase().includes(search.toLowerCase()) ||
                 m.originalName?.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      let cmp = 0
      if (sortBy === 'name') cmp = a.title.localeCompare(b.title)
      else if (sortBy === 'size') cmp = (a.fileSize || 0) - (b.fileSize || 0)
      else cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      return sortAsc ? cmp : -cmp
    })

  const toggleSort = (col: typeof sortBy) => {
    if (sortBy === col) setSortAsc(a => !a)
    else { setSortBy(col); setSortAsc(false) }
  }

  const SortIcon = ({ col }: { col: typeof sortBy }) =>
    sortBy === col
      ? sortAsc ? <ChevronUp size={12} /> : <ChevronDown size={12} />
      : <ChevronDown size={12} className="opacity-30" />

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-5xl mx-auto animate-fade-in">
      {/* Header */}
      <div className="mb-6">
        <h1 className="font-display text-2xl sm:text-3xl text-gray-100">My Materials</h1>
        <p className="text-gray-500 text-sm mt-1">Upload PDF, DOCX, PPTX, or TXT files — then read aloud with AI coaching or convert to a podcast</p>
      </div>

      {/* Upload zone */}
      <div
        className={`mb-6 border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all
          ${dragover ? 'border-gold/60 bg-gold/5' : 'border-white/10 hover:border-gold/30 hover:bg-gold/[0.03]'}`}
        onClick={() => fileRef.current?.click()}
        onDragOver={e => { e.preventDefault(); setDragover(true) }}
        onDragLeave={() => setDragover(false)}
        onDrop={e => { e.preventDefault(); setDragover(false); handleUpload(e.dataTransfer.files[0]) }}
      >
        {uploading ? (
          <div className="flex flex-col items-center gap-3">
            <span className="spinner w-8 h-8" />
            <p className="text-gray-400 text-sm">Uploading…</p>
          </div>
        ) : (
          <>
            <CloudUpload size={32} className="text-gray-600 mx-auto mb-3" />
            <p className="text-gray-300 font-medium">Drop a file here or <span className="text-gold">browse</span></p>
            <p className="text-xs text-gray-600 mt-1">PDF · DOCX · PPTX · TXT · max 20 MB</p>
          </>
        )}
        <input ref={fileRef} type="file" accept=".pdf,.pptx,.txt,.docx" className="hidden"
          onChange={e => handleUpload(e.target.files?.[0])} />
      </div>

      {/* Search + count */}
      {materials.length > 0 && (
        <div className="flex items-center gap-3 mb-4 flex-wrap">
          <div className="relative flex-1 min-w-[180px] max-w-xs">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <input
              className="input pl-9 py-2 text-sm"
              placeholder="Search materials…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <span className="text-xs text-gray-500 ml-auto shrink-0">
            {filtered.length} of {materials.length} file{materials.length !== 1 ? 's' : ''}
          </span>
        </div>
      )}

      {/* Table */}
      {filtered.length > 0 ? (
        <div className="card p-0 overflow-hidden">
          {/* Desktop table */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.07]">
                  <th className="text-left px-5 py-3 text-xs text-gray-500 uppercase tracking-widest font-medium w-8">Type</th>
                  <th
                    className="text-left px-4 py-3 text-xs text-gray-500 uppercase tracking-widest font-medium cursor-pointer hover:text-gray-300 select-none"
                    onClick={() => toggleSort('name')}
                  >
                    <span className="flex items-center gap-1">Name <SortIcon col="name" /></span>
                  </th>
                  <th
                    className="text-left px-4 py-3 text-xs text-gray-500 uppercase tracking-widest font-medium cursor-pointer hover:text-gray-300 select-none"
                    onClick={() => toggleSort('date')}
                  >
                    <span className="flex items-center gap-1">Uploaded <SortIcon col="date" /></span>
                  </th>
                  <th
                    className="text-left px-4 py-3 text-xs text-gray-500 uppercase tracking-widest font-medium cursor-pointer hover:text-gray-300 select-none"
                    onClick={() => toggleSort('size')}
                  >
                    <span className="flex items-center gap-1">Size <SortIcon col="size" /></span>
                  </th>
                  <th className="text-right px-5 py-3 text-xs text-gray-500 uppercase tracking-widest font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {filtered.map(m => {
                  const ext  = m.fileType || m.originalName?.split('.').pop() || 'txt'
                  const Icon = FILE_ICONS[ext] || File
                  const colorClass = FILE_COLORS[ext] || 'text-gray-400 bg-gray-500/10'
                  return (
                    <tr key={m._id} className="hover:bg-white/[0.02] transition-colors group">
                      <td className="px-5 py-3.5">
                        <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${colorClass}`}>
                          <Icon size={14} />
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <p className="font-medium text-gray-100 truncate max-w-[260px]">{m.title}</p>
                        {m.originalName && m.originalName !== m.title && (
                          <p className="text-xs text-gray-600 truncate max-w-[260px]">{m.originalName}</p>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-gray-400 whitespace-nowrap">
                        {formatDate(m.createdAt)}
                      </td>
                      <td className="px-4 py-3.5 text-gray-400 whitespace-nowrap">
                        {formatSize(m.fileSize)}
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center justify-end gap-1.5 opacity-60 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => navigate(`/read/${m._id}`)}
                            className="btn-ghost px-2.5 py-1.5 text-xs text-teal-soft hover:text-teal-soft hover:bg-teal-muted"
                            title="Read Aloud"
                          >
                            <BookOpen size={13} /> Read
                          </button>
                          <button
                            onClick={() => navigate(`/podcast?material=${m._id}`)}
                            className="btn-ghost px-2.5 py-1.5 text-xs text-violet-soft hover:text-violet-soft hover:bg-violet-muted"
                            title="Generate Podcast"
                          >
                            <Mic2 size={13} /> Podcast
                          </button>
                          {m.cloudinaryUrl && (
                            <a
                              href={m.cloudinaryUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="btn-ghost px-2 py-1.5"
                              title="Open file"
                            >
                              <ExternalLink size={13} />
                            </a>
                          )}
                          <button
                            onClick={() => handleDelete(m._id, m.title)}
                            disabled={deleting === m._id}
                            className="btn-ghost px-2 py-1.5 text-gray-600 hover:text-red-400"
                            title="Delete"
                          >
                            {deleting === m._id ? <span className="spinner w-3 h-3" /> : <Trash2 size={13} />}
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile card list */}
          <div className="sm:hidden divide-y divide-white/[0.04]">
            {filtered.map(m => {
              const ext  = m.fileType || m.originalName?.split('.').pop() || 'txt'
              const Icon = FILE_ICONS[ext] || File
              const colorClass = FILE_COLORS[ext] || 'text-gray-400 bg-gray-500/10'
              return (
                <div key={m._id} className="p-4 flex items-start gap-3">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${colorClass}`}>
                    <Icon size={16} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-100 text-sm truncate">{m.title}</p>
                    <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                      <span className="flex items-center gap-1"><Calendar size={10} />{formatDate(m.createdAt)}</span>
                      <span className="flex items-center gap-1"><HardDrive size={10} />{formatSize(m.fileSize)}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-2.5">
                      <button onClick={() => navigate(`/read/${m._id}`)}
                        className="btn-ghost px-2.5 py-1 text-xs text-teal-soft hover:bg-teal-muted">
                        <BookOpen size={12} /> Read
                      </button>
                      <button onClick={() => navigate(`/podcast?material=${m._id}`)}
                        className="btn-ghost px-2.5 py-1 text-xs text-violet-soft hover:bg-violet-muted">
                        <Mic2 size={12} /> Podcast
                      </button>
                      <button onClick={() => handleDelete(m._id, m.title)}
                        disabled={deleting === m._id}
                        className="btn-ghost px-2 py-1 text-gray-600 hover:text-red-400 ml-auto">
                        {deleting === m._id ? <span className="spinner w-3 h-3" /> : <Trash2 size={12} />}
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ) : (
        <div className="card flex flex-col items-center justify-center py-16 text-center">
          <Upload size={40} className="text-gray-700 mb-3" />
          <p className="text-gray-400 font-medium">
            {search ? 'No materials match your search' : 'No materials uploaded yet'}
          </p>
          <p className="text-gray-600 text-xs mt-1">
            {search ? 'Try a different keyword' : 'Upload a PDF, DOCX, PPTX, or TXT to get started'}
          </p>
        </div>
      )}
    </div>
  )
}
