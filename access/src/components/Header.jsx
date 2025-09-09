import React from 'react';
import { motion } from 'framer-motion';
import ThemeToggle from './ThemeToggle';

export default function Header() {
  return (
    <motion.header 
      className="sticky top-0 z-40 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60"
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      role="banner"
    >
      <div className="container flex h-16 items-center justify-between py-4">
        <div className="flex gap-6 md:gap-10">
          <a href="/" className="flex items-center space-x-2">
            <motion.div 
              className="h-8 w-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-bold text-xl"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              A
            </motion.div>
            <span className="font-bold inline-block text-xl">AccessAnalyzer</span>
          </a>
          <nav className="hidden md:flex gap-6" aria-label="Main navigation">
            <a 
              href="#features" 
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-primary focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 rounded-md px-2 py-1"
            >
              Features
            </a>
            <a 
              href="#documentation" 
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-primary focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 rounded-md px-2 py-1"
            >
              Documentation
            </a>
            <a 
              href="#about" 
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-primary focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 rounded-md px-2 py-1"
            >
              About
            </a>
          </nav>
        </div>
        <div className="flex items-center gap-4">
          <ThemeToggle />
          <motion.button
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            aria-label="Get Started"
          >
            Get Started
          </motion.button>
        </div>
      </div>
    </motion.header>
  );
}