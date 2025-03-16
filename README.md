# Gmail Voice Dictation Chrome Extension

A Chrome extension that enables voice dictation in Gmail with proper noun correction.

## Features

- Voice-to-text dictation directly in Gmail compose
- Proper noun correction using OpenAI API
- Visual feedback during recording

## Installation

1. Open Chrome and go to `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked" and select the extension directory ("dist")
4. Enter your OpenAI API key in the extension settings

## Usage

1. Open Gmail and start a new compose window
2. Click the extension icon in your browser
3. Click "Start Dictation" to begin speaking
4. Your speech will be transcribed, with proper nouns corrected
5. Click "Stop Dictation" when finished

## Development

Built with TypeScript, utilizing:
- Web Speech API for voice recognition
- OpenAI API for proper noun correction
- Chrome Extension Manifest V3
