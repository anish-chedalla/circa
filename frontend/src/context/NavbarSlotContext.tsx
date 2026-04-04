/**
 * Provides a slot that pages can fill to render content inside the Navbar.
 * Used by MapDiscovery to inject the filter bar into the nav header.
 */

import { createContext, useContext, useState, type ReactNode } from 'react';

interface SlotContextValue {
  slot: ReactNode;
  setSlot: (node: ReactNode) => void;
}

const NavbarSlotContext = createContext<SlotContextValue>({ slot: null, setSlot: () => {} });

/** Wrap the app tree with this so pages can inject content into the Navbar. */
export function NavbarSlotProvider({ children }: { children: ReactNode }) {
  const [slot, setSlot] = useState<ReactNode>(null);
  return (
    <NavbarSlotContext.Provider value={{ slot, setSlot }}>
      {children}
    </NavbarSlotContext.Provider>
  );
}

/** Returns the slot state and setter for reading (Navbar) or writing (pages). */
export function useNavbarSlot() {
  return useContext(NavbarSlotContext);
}
