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

          {/* Tri-View Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Staff - takes 1 col */}
            <div className="lg:col-span-1">
              <StaffNotation />
            </div>
            
            {/* Piano - takes 2 cols */}
            <div className="lg:col-span-2">
              <PianoKeyboard />
            </div>
          </div>

          {/* Fretboard - full width */}
          <GuitarFretboard />

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
