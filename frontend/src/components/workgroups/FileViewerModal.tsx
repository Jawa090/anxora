import * as React from "react";
import { useState, useEffect, useMemo, useRef } from "react";
import * as XLSX from "xlsx";
import { renderAsync } from "docx-preview";
import * as mammoth from "mammoth";
import JSZip from "jszip";
import {
  X,
  Download,
  FileText,
  FileSpreadsheet,
  FileCode,
  FileIcon,
  Maximize2,
  Minimize2,
  ExternalLink,
  Copy,
  Check,
  Search,
  Loader2,
  AlertCircle,
  Presentation,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export interface PptSlide {
  slideNumber: number;
  title: string;
  paragraphs: string[];
  tables: string[][][];
  images: string[];
}

export interface FileViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  fileName: string;
  fileUrl: string;
  downloadUrl: string;
  fileSize?: number;
  fileType?: string;
}

const parsePptx = async (buffer: ArrayBuffer): Promise<PptSlide[]> => {
  const zip = await JSZip.loadAsync(buffer);

  const slideFiles = Object.keys(zip.files).filter((path) =>
    /^ppt\/slides\/slide\d+\.xml$/.test(path)
  );

  slideFiles.sort((a, b) => {
    const numA = parseInt(a.match(/slide(\d+)\.xml/)?.[1] || "0", 10);
    const numB = parseInt(b.match(/slide(\d+)\.xml/)?.[1] || "0", 10);
    return numA - numB;
  });

  if (slideFiles.length === 0) {
    throw new Error("No slides found in presentation");
  }

  const slides: PptSlide[] = [];
  const parser = new DOMParser();

  for (let i = 0; i < slideFiles.length; i++) {
    const slidePath = slideFiles[i];
    const xmlText = await zip.files[slidePath].async("text");
    const xmlDoc = parser.parseFromString(xmlText, "application/xml");

    const paragraphs: string[] = [];
    let title = "";

    const spElements = xmlDoc.getElementsByTagName("p:sp");
    for (let s = 0; s < spElements.length; s++) {
      const sp = spElements[s];
      const ph = sp.getElementsByTagName("p:ph")[0];
      const phType = ph?.getAttribute("type");
      const isTitleShape = phType === "title" || phType === "ctrTitle";

      const pNodes = sp.getElementsByTagName("a:p");
      for (let p = 0; p < pNodes.length; p++) {
        const pNode = pNodes[p];
        const tNodes = pNode.getElementsByTagName("a:t");
        let pText = "";
        for (let t = 0; t < tNodes.length; t++) {
          pText += tNodes[t].textContent || "";
        }
        const trimmed = pText.trim();
        if (trimmed) {
          if (isTitleShape && !title) {
            title = trimmed;
          } else {
            paragraphs.push(trimmed);
          }
        }
      }
    }

    if (!title && paragraphs.length > 0) {
      title = paragraphs.shift() || `Slide ${i + 1}`;
    } else if (!title) {
      title = `Slide ${i + 1}`;
    }

    const tables: string[][][] = [];
    const tblNodes = xmlDoc.getElementsByTagName("a:tbl");
    for (let t = 0; t < tblNodes.length; t++) {
      const tbl = tblNodes[t];
      const rows: string[][] = [];
      const trNodes = tbl.getElementsByTagName("a:tr");
      for (let r = 0; r < trNodes.length; r++) {
        const row: string[] = [];
        const tcNodes = trNodes[r].getElementsByTagName("a:tc");
        for (let c = 0; c < tcNodes.length; c++) {
          const tTags = tcNodes[c].getElementsByTagName("a:t");
          let cellText = "";
          for (let k = 0; k < tTags.length; k++) {
            cellText += tTags[k].textContent || "";
          }
          row.push(cellText.trim());
        }
        if (row.length > 0) rows.push(row);
      }
      if (rows.length > 0) tables.push(rows);
    }

    const slideNumberMatch = slidePath.match(/slide(\d+)\.xml/);
    const slideNum = slideNumberMatch ? slideNumberMatch[1] : `${i + 1}`;
    const relsPath = `ppt/slides/_rels/slide${slideNum}.xml.rels`;
    const images: string[] = [];

    if (zip.files[relsPath]) {
      const relsText = await zip.files[relsPath].async("text");
      const relsDoc = parser.parseFromString(relsText, "application/xml");
      const relationships = relsDoc.getElementsByTagName("Relationship");
      for (let rel = 0; rel < relationships.length; rel++) {
        const type = relationships[rel].getAttribute("Type") || "";
        const target = relationships[rel].getAttribute("Target") || "";
        if (type.includes("image") && target) {
          const cleanPath = target.startsWith("../")
            ? target.replace("../", "ppt/")
            : `ppt/slides/${target}`;
          if (zip.files[cleanPath]) {
            const imgBlob = await zip.files[cleanPath].async("blob");
            images.push(URL.createObjectURL(imgBlob));
          }
        }
      }
    }

    slides.push({
      slideNumber: i + 1,
      title,
      paragraphs,
      tables,
      images,
    });
  }

  return slides;
};

export function FileViewerModal({
  isOpen,
  onClose,
  fileName,
  fileUrl,
  downloadUrl,
  fileSize = 0,
  fileType = "",
}: FileViewerModalProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [copied, setCopied] = useState(false);

  // Content states
  const [textContent, setTextContent] = useState<string>("");
  const [jsonContent, setJsonContent] = useState<any>(null);

  // Word states
  const [wordBlob, setWordBlob] = useState<Blob | null>(null);
  const [wordRendering, setWordRendering] = useState(false);
  const docxContainerRef = useRef<HTMLDivElement>(null);

  // PowerPoint states
  const [pptSlides, setPptSlides] = useState<PptSlide[]>([]);
  const [activeSlideIndex, setActiveSlideIndex] = useState(0);

  // Excel states
  const [workbook, setWorkbook] = useState<XLSX.WorkBook | null>(null);
  const [activeSheet, setActiveSheet] = useState<string>("");
  const [sheetData, setSheetData] = useState<any[][]>([]);
  const [excelSearch, setExcelSearch] = useState<string>("");

  const ext = useMemo(() => {
    return (fileName || "").split(".").pop()?.toLowerCase() || "";
  }, [fileName]);

  const fileCategory = useMemo(() => {
    if (ext === "pdf" || fileType.includes("pdf")) return "pdf";
    if (
      ["docx", "doc"].includes(ext) ||
      fileType.includes("word") ||
      fileType.includes("officedocument.wordprocessingml")
    )
      return "word";
    if (
      ["pptx", "ppt", "pps", "ppsx"].includes(ext) ||
      fileType.includes("presentation") ||
      fileType.includes("powerpoint")
    )
      return "ppt";
    if (["xlsx", "xls", "csv"].includes(ext) || fileType.includes("spreadsheet") || fileType.includes("excel"))
      return "excel";
    if (ext === "json" || fileType.includes("json")) return "json";
    if (
      ["txt", "log", "md", "js", "jsx", "ts", "tsx", "html", "css", "py", "sql", "xml", "yml", "yaml", "env"].includes(
        ext
      ) ||
      fileType.startsWith("text/")
    )
      return "text";
    if (["png", "jpg", "jpeg", "gif", "webp", "svg"].includes(ext) || fileType.startsWith("image/"))
      return "image";
    return "other";
  }, [ext, fileType]);

  useEffect(() => {
    if (!isOpen || !fileUrl) return;

    setLoading(true);
    setError(null);
    setTextContent("");
    setJsonContent(null);
    setWordBlob(null);
    setWordRendering(false);
    setPptSlides([]);
    setActiveSlideIndex(0);
    setWorkbook(null);
    setSheetData([]);
    setActiveSheet("");
    setExcelSearch("");

    const loadContent = async () => {
      try {
        if (fileCategory === "pdf" || fileCategory === "image") {
          setLoading(false);
          return;
        }

        if (fileCategory === "word") {
          const res = await fetch(fileUrl);
          if (!res.ok) throw new Error("Failed to load Word document");
          const blob = await res.blob();
          setWordBlob(blob);
          setLoading(false);
          return;
        }

        if (fileCategory === "ppt") {
          const res = await fetch(fileUrl);
          if (!res.ok) throw new Error("Failed to load presentation file");
          const buffer = await res.arrayBuffer();
          try {
            const slides = await parsePptx(buffer);
            setPptSlides(slides);
            setActiveSlideIndex(0);
            setLoading(false);
            return;
          } catch (pptErr: any) {
            console.error("PPTX parse failed:", pptErr);
            throw new Error(
              "Unable to preview presentation. It may be an older .ppt binary format or encrypted. Please download to view."
            );
          }
        }

        if (fileCategory === "excel") {
          const res = await fetch(fileUrl);
          if (!res.ok) throw new Error("Failed to load spreadsheet file");
          const buffer = await res.arrayBuffer();
          const wb = XLSX.read(buffer, { type: "array" });
          setWorkbook(wb);
          if (wb.SheetNames.length > 0) {
            const firstSheet = wb.SheetNames[0];
            setActiveSheet(firstSheet);
            const ws = wb.Sheets[firstSheet];
            const data = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];
            setSheetData(data);
          }
          setLoading(false);
          return;
        }

        if (fileCategory === "json") {
          const res = await fetch(fileUrl);
          if (!res.ok) throw new Error("Failed to load JSON file");
          const text = await res.text();
          try {
            const parsed = JSON.parse(text);
            setJsonContent(parsed);
          } catch {
            setTextContent(text);
          }
          setLoading(false);
          return;
        }

        if (fileCategory === "text") {
          const res = await fetch(fileUrl);
          if (!res.ok) throw new Error("Failed to load text file");
          const text = await res.text();
          setTextContent(text);
          setLoading(false);
          return;
        }

        setLoading(false);
      } catch (err: any) {
        console.error("Error loading file content:", err);
        setError(err.message || "Failed to load file preview");
        setLoading(false);
      }
    };

    loadContent();
  }, [isOpen, fileUrl, fileCategory]);

  // Render Word document into container when wordBlob is available
  useEffect(() => {
    if (!wordBlob || !docxContainerRef.current) return;
    let isCancelled = false;
    setWordRendering(true);

    const renderWord = async () => {
      try {
        if (docxContainerRef.current) {
          docxContainerRef.current.innerHTML = "";
          await renderAsync(wordBlob, docxContainerRef.current, undefined, {
            className: "docx-preview-content",
            inWrapper: false,
            ignoreWidth: false,
            ignoreHeight: false,
            ignoreFonts: false,
            breakPages: true,
            useBase64URL: true,
          });
        }
      } catch (docxErr) {
        console.warn("docx-preview failed, trying mammoth fallback:", docxErr);
        try {
          const arrayBuffer = await wordBlob.arrayBuffer();
          const result = await mammoth.convertToHtml({ arrayBuffer });
          if (!isCancelled && docxContainerRef.current) {
            docxContainerRef.current.innerHTML = `<div class="docx-mammoth-body p-4 sm:p-8 font-sans leading-relaxed text-foreground">${result.value}</div>`;
          }
        } catch (mammothErr: any) {
          console.error("Both docx-preview and mammoth failed:", mammothErr);
          if (!isCancelled) {
            setError("Could not render Word document. Please download to view.");
          }
        }
      } finally {
        if (!isCancelled) {
          setWordRendering(false);
        }
      }
    };

    renderWord();

    return () => {
      isCancelled = true;
    };
  }, [wordBlob]);

  const handleSheetChange = (sheetName: string) => {
    if (!workbook) return;
    setActiveSheet(sheetName);
    const ws = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];
    setSheetData(data);
  };

  const filteredSheetData = useMemo(() => {
    if (!excelSearch.trim()) return sheetData;
    const q = excelSearch.toLowerCase();
    return sheetData.filter((row) =>
      row.some((cell) => cell !== null && cell !== undefined && String(cell).toLowerCase().includes(q))
    );
  }, [sheetData, excelSearch]);

  const handleCopyText = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const formatFileSize = (size = 0) => {
    if (size === 0) return "0 B";
    if (size < 1024) return `${size} B`;
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getCategoryIcon = () => {
    switch (fileCategory) {
      case "pdf":
        return <FileText className="h-5 w-5 text-red-500" />;
      case "word":
        return <FileText className="h-5 w-5 text-blue-500" />;
      case "ppt":
        return <Presentation className="h-5 w-5 text-amber-500" />;
      case "excel":
        return <FileSpreadsheet className="h-5 w-5 text-emerald-500" />;
      case "json":
        return <FileCode className="h-5 w-5 text-amber-500" />;
      case "text":
        return <FileText className="h-5 w-5 text-primary" />;
      default:
        return <FileIcon className="h-5 w-5 text-muted-foreground" />;
    }
  };

  useEffect(() => {
    if (fileCategory !== "ppt" || pptSlides.length === 0) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === "PageDown") {
        setActiveSlideIndex((prev) => Math.min(pptSlides.length - 1, prev + 1));
      } else if (e.key === "ArrowLeft" || e.key === "PageUp") {
        setActiveSlideIndex((prev) => Math.max(0, prev - 1));
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [fileCategory, pptSlides.length]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] bg-black/70 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className={`bg-card border border-border shadow-2xl rounded-2xl flex flex-col overflow-hidden transition-all duration-200 ${
          isFullscreen ? "w-full h-full rounded-none" : "w-full max-w-5xl h-[88vh]"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/40 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0 pr-4">
            <div className="p-2 rounded-xl bg-background border border-border/80 shadow-xs shrink-0">
              {getCategoryIcon()}
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-bold text-foreground truncate max-w-md" title={fileName}>
                {fileName}
              </h2>
              <p className="text-[11px] text-muted-foreground font-mono">
                {ext.toUpperCase()} • {formatFileSize(fileSize)}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {/* Direct Open Link (PDF/Image) */}
            {(fileCategory === "pdf" || fileCategory === "image") && (
              <Button
                variant="outline"
                size="sm"
                className="h-8 px-2.5 text-xs gap-1.5 hidden sm:flex"
                onClick={() => window.open(fileUrl, "_blank")}
                title="Open in new tab"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                <span>Open in Tab</span>
              </Button>
            )}

            {/* Save As / Download Button */}
            <Button
              variant="default"
              size="sm"
              className="h-8 px-3 text-xs gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm"
              onClick={() => {
                const a = document.createElement("a");
                a.href = downloadUrl;
                a.download = fileName;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
              }}
              title="Save as..."
            >
              <Download className="h-3.5 w-3.5" />
              <span>Save as</span>
            </Button>

            {/* Fullscreen Toggle */}
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
              onClick={() => setIsFullscreen((prev) => !prev)}
              title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
            >
              {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </Button>

            {/* Close Button */}
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-destructive/10 hover:text-destructive rounded-full"
              onClick={onClose}
              title="Close"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 min-h-0 bg-background overflow-hidden relative flex flex-col">
          {loading ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-3">
              <Loader2 className="h-8 w-8 text-primary animate-spin" />
              <p className="text-xs text-muted-foreground font-medium">Loading preview...</p>
            </div>
          ) : error ? (
            <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
              <AlertCircle className="h-10 w-10 text-destructive mb-2" />
              <p className="text-sm font-semibold text-foreground mb-1">Unable to preview file</p>
              <p className="text-xs text-muted-foreground max-w-sm mb-4">{error}</p>
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={() => {
                  const a = document.createElement("a");
                  a.href = downloadUrl;
                  a.download = fileName;
                  document.body.appendChild(a);
                  a.click();
                  document.body.removeChild(a);
                }}
              >
                <Download className="h-4 w-4" />
                Download file directly
              </Button>
            </div>
          ) : fileCategory === "pdf" ? (
            /* PDF Viewer */
            <div className="w-full h-full bg-neutral-900 flex flex-col">
              <iframe
                src={`${fileUrl}#toolbar=1&navpanes=1`}
                className="w-full h-full border-0"
                title={fileName}
              />
            </div>
          ) : fileCategory === "word" ? (
            /* Word Document Viewer (.docx, .doc) */
            <div className="flex-1 flex flex-col h-full overflow-hidden">
              <div className="p-2 border-b border-border bg-muted/20 flex items-center justify-between shrink-0">
                <span className="text-[11px] font-mono text-muted-foreground font-semibold px-2">
                  Word Document
                </span>
                {wordRendering && (
                  <div className="flex items-center gap-1.5 text-xs text-primary font-medium animate-pulse px-2">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>Formatting document...</span>
                  </div>
                )}
              </div>
              <div className="flex-1 w-full overflow-auto bg-muted/10 p-4 sm:p-8 flex justify-center select-text">
                <style>{`
                  .docx-viewer-themed {
                    color: hsl(var(--foreground)) !important;
                    background-color: transparent !important;
                  }
                  .docx-viewer-themed * {
                    color: inherit !important;
                    border-color: hsl(var(--border)) !important;
                  }
                  .docx-viewer-themed p {
                    margin-bottom: 0.85rem !important;
                    line-height: 1.7 !important;
                  }
                  .docx-viewer-themed h1, .docx-viewer-themed h2, .docx-viewer-themed h3, .docx-viewer-themed h4 {
                    font-weight: 700 !important;
                    margin-top: 1.5rem !important;
                    margin-bottom: 0.75rem !important;
                    color: hsl(var(--foreground)) !important;
                  }
                  .docx-viewer-themed table {
                    border-collapse: collapse !important;
                    width: 100% !important;
                    margin: 1rem 0 !important;
                    border: 1px solid hsl(var(--border)) !important;
                  }
                  .docx-viewer-themed td, .docx-viewer-themed th {
                    border: 1px solid hsl(var(--border)) !important;
                    padding: 8px 12px !important;
                  }
                  .docx-viewer-themed th {
                    background-color: hsl(var(--muted)) !important;
                    font-weight: 600 !important;
                  }
                `}</style>
                <div
                  ref={docxContainerRef}
                  className="w-full max-w-4xl bg-card text-foreground border border-border/80 shadow-md rounded-xl min-h-[600px] p-6 sm:p-12 docx-viewer-themed font-sans leading-relaxed overflow-x-auto"
                />
              </div>
            </div>
          ) : fileCategory === "ppt" ? (
            /* PowerPoint Presentation Viewer (.pptx, .ppt) */
            <div className="flex-1 flex flex-col sm:flex-row h-full overflow-hidden bg-neutral-900">
              {/* Left Slide Thumbnails */}
              <div className="w-full sm:w-56 border-b sm:border-b-0 sm:border-r border-neutral-800 bg-neutral-950 p-2.5 overflow-y-auto flex sm:flex-col gap-2 shrink-0 scrollbar-thin">
                <div className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider px-2 py-1 hidden sm:block">
                  Slides ({pptSlides.length})
                </div>
                {pptSlides.map((slide, idx) => (
                  <button
                    key={idx}
                    onClick={() => setActiveSlideIndex(idx)}
                    className={`flex items-start gap-2 p-2 rounded-lg text-left transition-all cursor-pointer border ${
                      activeSlideIndex === idx
                        ? "bg-amber-500/15 border-amber-500/50 text-white shadow-sm"
                        : "bg-neutral-900/60 border-neutral-800 text-neutral-400 hover:bg-neutral-800 hover:text-white"
                    }`}
                  >
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-300 shrink-0">
                      {slide.slideNumber}
                    </span>
                    <span className="text-xs font-semibold truncate leading-tight flex-1">
                      {slide.title || `Slide ${slide.slideNumber}`}
                    </span>
                  </button>
                ))}
              </div>

              {/* Main Slide Viewer */}
              <div className="flex-1 flex flex-col h-full min-w-0">
                {/* Current Slide Canvas */}
                <div className="flex-1 p-4 sm:p-8 flex items-center justify-center overflow-auto">
                  {pptSlides[activeSlideIndex] && (
                    <div className="w-full max-w-4xl aspect-[16/9] bg-gradient-to-br from-neutral-800 to-neutral-900 text-white rounded-2xl shadow-2xl border border-neutral-700/60 p-6 sm:p-10 flex flex-col justify-between relative overflow-hidden">
                      {/* Top accent bar */}
                      <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-amber-500 via-orange-500 to-red-500" />

                      {/* Slide Header */}
                      <div className="mb-4">
                        <span className="text-[10px] font-mono uppercase tracking-widest text-amber-400 font-bold">
                          Slide {activeSlideIndex + 1}
                        </span>
                        <h1 className="text-xl sm:text-3xl font-extrabold text-white mt-1 leading-snug">
                          {pptSlides[activeSlideIndex].title}
                        </h1>
                      </div>

                      {/* Slide Content */}
                      <div className="flex-1 overflow-y-auto pr-2 scrollbar-thin my-2">
                        {/* Paragraphs / Bullets */}
                        {pptSlides[activeSlideIndex].paragraphs.length > 0 && (
                          <div className="space-y-2 mb-4">
                            {pptSlides[activeSlideIndex].paragraphs.map((p, pIdx) => (
                              <div key={pIdx} className="flex items-start gap-2.5">
                                <span className="h-1.5 w-1.5 rounded-full bg-amber-400 mt-2 shrink-0" />
                                <p className="text-sm sm:text-base text-neutral-200 leading-relaxed">
                                  {p}
                                </p>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Tables */}
                        {pptSlides[activeSlideIndex].tables.map((table, tIdx) => (
                          <div key={tIdx} className="my-4 overflow-x-auto">
                            <table className="w-full border-collapse border border-neutral-700 text-xs sm:text-sm">
                              <tbody>
                                {table.map((row, rIdx) => (
                                  <tr key={rIdx} className={rIdx === 0 ? "bg-neutral-700/60 font-bold" : "border-t border-neutral-700"}>
                                    {row.map((cell, cIdx) => (
                                      <td key={cIdx} className="p-2 border border-neutral-700 text-neutral-200">
                                        {cell}
                                      </td>
                                    ))}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        ))}

                        {/* Images */}
                        {pptSlides[activeSlideIndex].images.length > 0 && (
                          <div className="flex flex-wrap gap-3 mt-4">
                            {pptSlides[activeSlideIndex].images.map((imgUrl, iIdx) => (
                              <img
                                key={iIdx}
                                src={imgUrl}
                                alt={`Slide ${activeSlideIndex + 1} image ${iIdx + 1}`}
                                className="max-h-48 rounded-lg object-contain shadow-md border border-neutral-700 bg-black/40"
                              />
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Slide Footer */}
                      <div className="flex items-center justify-between text-[11px] text-neutral-400 pt-2 border-t border-neutral-800">
                        <span>{fileName}</span>
                        <span>
                          {activeSlideIndex + 1} / {pptSlides.length}
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Bottom Navigation Toolbar */}
                <div className="p-3 border-t border-neutral-800 bg-neutral-950 flex items-center justify-between px-6 shrink-0">
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={activeSlideIndex === 0}
                    onClick={() => setActiveSlideIndex((prev) => Math.max(0, prev - 1))}
                    className="gap-1.5 text-xs text-neutral-300 hover:text-white disabled:opacity-40"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    <span>Previous</span>
                  </Button>

                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-neutral-300">
                      Slide <span className="text-amber-400 font-bold">{activeSlideIndex + 1}</span> of {pptSlides.length}
                    </span>
                  </div>

                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={activeSlideIndex >= pptSlides.length - 1}
                    onClick={() => setActiveSlideIndex((prev) => Math.min(pptSlides.length - 1, prev + 1))}
                    className="gap-1.5 text-xs text-neutral-300 hover:text-white disabled:opacity-40"
                  >
                    <span>Next</span>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          ) : fileCategory === "excel" ? (
            /* Excel / Spreadsheet Viewer */
            <div className="flex-1 flex flex-col h-full overflow-hidden">
              {/* Excel Toolbar: Search + Sheet Tabs */}
              <div className="p-2.5 border-b border-border bg-muted/20 flex flex-wrap items-center justify-between gap-2 shrink-0">
                {/* Sheets Tabs */}
                <div className="flex items-center gap-1 overflow-x-auto max-w-xl scrollbar-thin">
                  {workbook?.SheetNames.map((sheet) => (
                    <button
                      key={sheet}
                      onClick={() => handleSheetChange(sheet)}
                      className={`px-3 py-1 rounded-md text-xs font-semibold whitespace-nowrap transition-all ${
                        activeSheet === sheet
                          ? "bg-emerald-600 text-white shadow-xs"
                          : "bg-muted text-muted-foreground hover:text-foreground hover:bg-muted/80"
                      }`}
                    >
                      {sheet}
                    </button>
                  ))}
                </div>

                {/* Table search */}
                <div className="relative w-48 sm:w-60">
                  <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    type="text"
                    value={excelSearch}
                    onChange={(e) => setExcelSearch(e.target.value)}
                    placeholder="Search in sheet..."
                    className="h-7 pl-8 text-xs bg-background"
                  />
                  {excelSearch && (
                    <button
                      onClick={() => setExcelSearch("")}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground text-xs"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>

              {/* Data Table */}
              <div className="flex-1 overflow-auto">
                {filteredSheetData.length === 0 ? (
                  <div className="p-8 text-center text-xs text-muted-foreground">No matching data found</div>
                ) : (
                  <table className="w-full border-collapse text-xs">
                    <thead>
                      <tr className="bg-muted/60 sticky top-0 z-10 border-b border-border shadow-xs">
                        <th className="w-12 px-2.5 py-1.5 text-center text-[10px] font-mono text-muted-foreground border-r border-border bg-muted/80 sticky left-0 z-20">
                          #
                        </th>
                        {filteredSheetData[0]?.map((_, colIdx) => {
                          const colLetter = XLSX.utils.encode_col(colIdx);
                          return (
                            <th
                              key={colIdx}
                              className="px-3 py-1.5 text-left font-bold text-foreground border-r border-border last:border-r-0 whitespace-nowrap"
                            >
                              {colLetter}
                            </th>
                          );
                        })}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredSheetData.map((row, rowIdx) => (
                        <tr
                          key={rowIdx}
                          className="hover:bg-muted/40 border-b border-border/50 transition-colors odd:bg-card even:bg-muted/10"
                        >
                          <td className="px-2.5 py-1.5 text-center text-[10px] font-mono text-muted-foreground border-r border-border bg-muted/40 sticky left-0 z-10 font-bold">
                            {rowIdx + 1}
                          </td>
                          {filteredSheetData[0]?.map((_, colIdx) => (
                            <td
                              key={colIdx}
                              className="px-3 py-1.5 border-r border-border/50 last:border-r-0 text-foreground whitespace-pre-wrap max-w-xs break-words"
                            >
                              {row[colIdx] !== undefined && row[colIdx] !== null ? String(row[colIdx]) : ""}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          ) : fileCategory === "json" ? (
            /* JSON Viewer */
            <div className="flex-1 flex flex-col h-full overflow-hidden">
              <div className="p-2 border-b border-border bg-muted/20 flex items-center justify-between shrink-0">
                <span className="text-[11px] font-mono text-muted-foreground font-semibold px-2">
                  JSON Document
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleCopyText(JSON.stringify(jsonContent || textContent, null, 2))}
                  className="h-7 text-xs gap-1.5"
                >
                  {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                  <span>{copied ? "Copied" : "Copy JSON"}</span>
                </Button>
              </div>
              <div className="flex-1 p-4 overflow-auto font-mono text-xs bg-muted/10 select-text">
                <pre className="text-foreground leading-relaxed whitespace-pre-wrap">
                  {jsonContent ? JSON.stringify(jsonContent, null, 2) : textContent}
                </pre>
              </div>
            </div>
          ) : fileCategory === "text" ? (
            /* Plain Text / Code Viewer */
            <div className="flex-1 flex flex-col h-full overflow-hidden">
              <div className="p-2 border-b border-border bg-muted/20 flex items-center justify-between shrink-0">
                <span className="text-[11px] font-mono text-muted-foreground font-semibold px-2">
                  {textContent.split("\n").length} lines
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleCopyText(textContent)}
                  className="h-7 text-xs gap-1.5"
                >
                  {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                  <span>{copied ? "Copied" : "Copy Text"}</span>
                </Button>
              </div>
              <div className="flex-1 p-4 overflow-auto font-mono text-xs bg-muted/10 select-text">
                <pre className="text-foreground leading-relaxed whitespace-pre-wrap">
                  {textContent}
                </pre>
              </div>
            </div>
          ) : fileCategory === "image" ? (
            /* Image Viewer */
            <div className="flex-1 flex items-center justify-center p-4 bg-black/40 overflow-auto">
              <img
                src={fileUrl}
                alt={fileName}
                className="max-w-full max-h-full object-contain rounded-lg shadow-xl"
              />
            </div>
          ) : (
            /* Generic / Other files fallback */
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
              <div className="h-16 w-16 rounded-2xl bg-muted flex items-center justify-center mb-4 border border-border">
                <FileIcon className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-sm font-bold text-foreground mb-1">{fileName}</h3>
              <p className="text-xs text-muted-foreground font-mono mb-4">
                {ext.toUpperCase()} • {formatFileSize(fileSize)}
              </p>
              <p className="text-xs text-muted-foreground max-w-xs mb-6">
                Online preview is not supported for this file format. You can download and view it on your device.
              </p>
              <Button
                variant="default"
                size="sm"
                className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
                onClick={() => {
                  const a = document.createElement("a");
                  a.href = downloadUrl;
                  a.download = fileName;
                  document.body.appendChild(a);
                  a.click();
                  document.body.removeChild(a);
                }}
              >
                <Download className="h-4 w-4" />
                Save as / Download
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
