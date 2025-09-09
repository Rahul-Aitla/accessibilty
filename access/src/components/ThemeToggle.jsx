import React, { useEffect, useState } from 'react';
import { SunIcon, MoonIcon } from '@radix-ui/react-icons';
import { motion } from 'framer-motion';

export default function ThemeToggle() {
  const [dark, setDark] = useState(() =>
    window.matchMedia('(prefers-color-scheme: dark)').matches
  );

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
  }, [dark]);

  return (
    <motion.button
      className="p-2 rounded-full bg-secondary text-secondary-foreground shadow-md focus:outline-none focus:ring-2 focus:ring-ring hover:bg-secondary/80 transition-colors"
      aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
      aria-pressed={dark}
      onClick={() => setDark(d => !d)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          setDark(d => !d);
        }
      }}
      whileHover={{ scale: 1.1 }}
      whileTap={{ scale: 0.9 }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2 }}
    >
      <motion.div
        initial={{ rotate: 0 }}
        animate={{ rotate: dark ? 180 : 0 }}
        transition={{ duration: 0.5, type: "spring", stiffness: 200 }}
      >
        {dark ? <SunIcon width={22} height={22} /> : <MoonIcon width={22} height={22} />}
      </motion.div>
    </motion.button>
  );
}
