import { useState } from "react";
import { HarmonicProvider, useHarmonic } from "@/contexts/HarmonicContext";
import { ControlSidebar } from "@/components/ControlSidebar";
import { PianoKeyboard } from "@/components/PianoKeyboard";
import { GuitarFretboard } from "@/components/GuitarFretboard";
import { StaffNotation } from "@/components/StaffNotation";
import { LinearNoteMap } from "@/components/LinearNoteMap";
import { DissonanceSpectrum } from "@/components/DissonanceSpectrum";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Menu, Trash2 } from "lucide-react";

function MainContent() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { clearNotes, activeNotes } = useHarmonic();

  return (
    <HarmonicProvider>
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
          {/* Header hints */}
          <div className="flex justify-end">
            <div className="text-[10px] font-mono text-muted-foreground text-right">
              <div>Click any note to activate</div>
              <div>Colors sync across all views</div>
            </div>
          </div>

          {/* Tri-View: Staff left, instruments right */}
          <div className="flex flex-col xl:flex-row gap-3 md:gap-4 flex-1 min-h-0">
            {/* Grand Staff - full vertical height */}
            <div className="xl:flex-1 xl:min-w-[340px] min-h-[480px] md:min-h-[520px] xl:min-h-0">
              <StaffNotation />
            </div>
            
            {/* Piano + Fretboard stacked in right column */}
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
    </HarmonicProvider>
  );
};

export default Index;
