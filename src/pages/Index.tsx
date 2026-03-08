import { useState } from "react";
import { HarmonicProvider } from "@/contexts/HarmonicContext";
import { ControlSidebar } from "@/components/ControlSidebar";
import { PianoKeyboard } from "@/components/PianoKeyboard";
import { GuitarFretboard } from "@/components/GuitarFretboard";
import { StaffNotation } from "@/components/StaffNotation";
import { LinearNoteMap } from "@/components/LinearNoteMap";
import { useIsMobile } from "@/hooks/use-mobile";

const Index = () => {
  const isMobile = useIsMobile();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <HarmonicProvider>
      <div className="flex h-screen overflow-hidden relative">
        {/* Mobile hamburger */}
        {isMobile && (
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="fixed top-3 left-3 z-50 p-2 rounded-md bg-card border border-border text-foreground"
            aria-label="Toggle menu"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              {sidebarOpen ? (
                <path d="M5 5L15 15M15 5L5 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              ) : (
                <>
                  <path d="M3 5h14M3 10h14M3 15h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </>
              )}
            </svg>
          </button>
        )}

        {/* Sidebar - overlay on mobile, static on desktop */}
        {isMobile ? (
          <>
            {sidebarOpen && (
              <div
                className="fixed inset-0 bg-background/60 backdrop-blur-sm z-30"
                onClick={() => setSidebarOpen(false)}
              />
            )}
            <div
              className={`fixed top-0 left-0 h-full z-40 transition-transform duration-300 ${
                sidebarOpen ? "translate-x-0" : "-translate-x-full"
              }`}
            >
              <ControlSidebar />
            </div>
          </>
        ) : (
          <ControlSidebar />
        )}

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
