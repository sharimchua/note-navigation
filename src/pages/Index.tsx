import { HarmonicProvider } from "@/contexts/HarmonicContext";
import { ControlSidebar } from "@/components/ControlSidebar";
import { PianoKeyboard } from "@/components/PianoKeyboard";
import { GuitarFretboard } from "@/components/GuitarFretboard";
import { StaffNotation } from "@/components/StaffNotation";

const Index = () => {
  return (
    <HarmonicProvider>
      <div className="flex h-screen overflow-hidden">
        <ControlSidebar />
        <main className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold font-mono text-foreground">
                The Harmonic <span className="text-primary">Mapper</span>
              </h1>
              <p className="text-xs font-mono text-muted-foreground">
                Sound & Symbol · Unified Tri-View Engine
              </p>
            </div>
            <div className="text-[10px] font-mono text-muted-foreground text-right">
              <div>Click any note to activate</div>
              <div>Colors sync across all views</div>
            </div>
          </div>

          {/* Tri-View: Staff left, instruments right */}
          <div className="flex flex-col xl:flex-row gap-4 flex-1 min-h-0">
            {/* Grand Staff - full vertical height */}
            <div className="xl:flex-1 xl:min-w-[340px] min-h-[360px] xl:min-h-0">
              <StaffNotation />
            </div>
            
            {/* Piano + Fretboard stacked in right column */}
            <div className="xl:w-[55%] 2xl:w-[60%] flex flex-col gap-4 shrink-0">
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
