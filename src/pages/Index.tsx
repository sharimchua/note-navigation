import { useState } from "react";
import { HarmonicProvider, useHarmonic } from "@/contexts/HarmonicContext";
import { ControlSidebar } from "@/components/ControlSidebar";
import { PianoKeyboard } from "@/components/PianoKeyboard";
import { GuitarFretboard } from "@/components/GuitarFretboard";
import { StaffNotation } from "@/components/StaffNotation";
import { LinearNoteMap } from "@/components/LinearNoteMap";
import { DissonanceSpectrum } from "@/components/DissonanceSpectrum";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Menu, Trash2, Volume2, VolumeX } from "lucide-react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

function MainContent() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { clearNotes, activeNotes, isMuted, setMuted, isKeyLocked, scaleLabelMode, setScaleLabelMode } = useHarmonic();

  return (
    <div className="flex h-screen overflow-hidden relative">
      {/* Sheet overlay sidebar for smaller screens (below xl) */}
      <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
        <SheetContent side="left" className="w-[280px] sm:w-[300px] overflow-y-auto p-0 bg-sidebar border-sidebar-border">
          <SheetHeader className="sr-only">
            <SheetTitle>Controls</SheetTitle>
            <SheetDescription>Adjust key, scale, and display settings.</SheetDescription>
          </SheetHeader>
          <ControlSidebar />
        </SheetContent>
      </Sheet>

      {/* Floating burger button — visible only below xl */}
      <button
        onClick={() => setSidebarOpen(true)}
        className="fixed top-3 left-3 z-40 w-10 h-10 rounded-lg flex xl:hidden items-center justify-center bg-card border border-border shadow-md hover:bg-accent text-muted-foreground hover:text-primary transition-colors"
        aria-label="Open controls"
      >
        <Menu size={20} />
      </button>

      {/* Fixed sidebar for xl+ screens */}
      <div className="hidden xl:block">
        <ControlSidebar />
      </div>

      <main className="flex-1 overflow-y-auto p-3 md:p-4 flex flex-col gap-3 md:gap-4">
        {/* Header */}
        <div className="flex items-center gap-2 justify-between">
          <div className="flex items-center gap-2">
            {activeNotes.size > 0 && (
              <button
                onClick={clearNotes}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono rounded-md border border-destructive/40 bg-destructive/10 text-destructive hover:bg-destructive/20 transition-all"
              >
                <Trash2 size={12} />
                Clear Notes
              </button>
            )}
            <button
              onClick={() => setMuted(!isMuted)}
              className={`flex items-center justify-center w-8 h-8 rounded-md border transition-all ${
                isMuted
                  ? 'border-destructive/40 bg-destructive/10 text-destructive'
                  : 'border-border bg-secondary/50 text-muted-foreground hover:text-primary hover:border-primary/50'
              }`}
              aria-label={isMuted ? "Unmute" : "Mute"}
            >
              {isMuted ? <VolumeX size={14} /> : <Volume2 size={14} />}
            </button>
            {isKeyLocked && (
              <ToggleGroup type="single" value={scaleLabelMode} onValueChange={(v) => v && setScaleLabelMode(v as any)} className="justify-start">
                <ToggleGroupItem value="solfege" size="sm" className="h-7 text-xs font-mono px-3">Solfege</ToggleGroupItem>
                <ToggleGroupItem value="degree" size="sm" className="h-7 text-xs font-mono px-3">Degrees</ToggleGroupItem>
              </ToggleGroup>
            )}
          </div>
          <div className="text-[10px] font-mono text-muted-foreground text-right">
            <div>Click any note to activate</div>
            <div>Colors sync across all views</div>
          </div>
        </div>

        {/* Tri-View: Staff left, instruments right */}
        <div className="flex flex-col xl:flex-row gap-3 md:gap-4 flex-1 min-h-0">
          <div className="xl:flex-1 xl:min-w-[340px] min-h-[480px] md:min-h-[520px] xl:min-h-0">
            <StaffNotation />
          </div>
          <div className="xl:w-[55%] 2xl:w-[60%] flex flex-col gap-2 md:gap-3 shrink-0">
            <LinearNoteMap />
            <PianoKeyboard />
            <GuitarFretboard />
            <DissonanceSpectrum />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between text-[9px] font-mono text-muted-foreground pt-2 border-t border-border">
          <span>© Midlife Muso · Ear-First Guitar & Piano Coaching</span>
          <a href="https://midlifemuso.com" target="_blank" rel="noopener noreferrer"
            className="hover:text-primary transition-colors">
            midlifemuso.com
          </a>
        </div>
      </main>
    </div>
  );
}

const Index = () => (
  <HarmonicProvider>
    <MainContent />
  </HarmonicProvider>
);

export default Index;
