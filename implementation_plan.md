# ProLink — Comprehensive Fixes & Improvements

## Overview
A full review of all reported issues and requested improvements to the ProLink app. The file is ~3407 lines (single `App.tsx`). Fixes will be applied directly to that file.

---

## Issues to Fix

### 1. 📋 Job Application — Professional LinkedIn-style Flow
**Current**: Applies by sending a raw CV text message.  
**Fix**: When user taps "Apply", open a professional modal with:
- Applicant summary (name, title, skills, location, bio)
- A pre-filled personal message textarea
- A "Send Application" button that sends a structured application to the employer

### 2. 👥 Groups — Share Posts + Media Upload
**Current**: Share-to-group button exists but media upload in group chat is too small.  
**Fix**:
- Share post to group: already has button, verify it works end-to-end  
- Media (image/video) upload in group chat: fix display sizing so media fills bubble properly (like Telegram/Instagram)
- Enable media upload from phone (file input `accept="image/*,video/*"`)

### 3. 👥 Groups — Members Count Fix
**Current**: Members show "0 عضو" even after joining.  
**Fix**: Fix members count display — use live DB count, fix the count update logic

### 4. 💬 Messages — Sidebar Width Too Wide
**Current**: Side chat panel is wider than conversation panel.  
**Fix**: Constrain sidebar to max ~280px, make conversation panel `flex-1`

### 5. 💬 Messages — Media Display Too Small
**Current**: Uploaded images/videos in messages are tiny.  
**Fix**: Media bubbles should fill the chat width properly (~240px min, proper max-width), aspect-ratio preserved, like Telegram

### 6. 🔔 Notifications — Persistent (Don't Disappear on Back)
**Current**: Notifications disappear when navigating away from the panel.  
**Fix**: Notifications persist in state. When re-opening the panel, they reload from DB. Mark as read only when explicitly clicked.

### 7. 📰 News — Make it Work
**Current**: News tab may not work / crashes on Trending in Profile.  
**Fix**: Protect the Trends tab with a try/catch, display safe fallback content. Ensure it doesn't crash the app.

### 8. 📱 Phone Login — Any Number + Fixed PIN
**Current**: Phone auth tries to use Supabase OTP which may fail.  
**Fix**: Allow **any phone number** to log in with a **fixed PIN: `123456`**. This is demo/test mode. Store user by phone in localStorage, create a mock profile if first time.

### 9. 👤 Profile — LinkedIn-style Professional Layout
**Current**: Profile modal is functional but basic.  
**Fix**:
- Show cover photo area (gradient fallback)
- Experience / Education / Skills sections with add/edit capability
- "Download CV" button that generates a PDF-like summary
- Better layout matching LinkedIn profile structure

---

## Proposed Changes

### [MODIFY] App.tsx

#### Phone Auth (Demo Mode)
- Replace Supabase OTP phone flow with mock: any number + PIN `123456`
- On success: look up or create a local profile keyed by phone number

#### Job Application Modal
- New `JobApplicationModal` component
- Shows applicant card (avatar, name, title, bio, skills)
- Message textarea pre-filled with professional message
- Sends to employer as structured message

#### Media Sizing Fix (Messages + Groups)
- Change message bubble media container: `min-w-[200px] max-w-[280px]` with `aspect-video` or `aspect-square`
- Images use `object-cover w-full rounded-2xl`

#### Sidebar Width Fix
- Messages sidebar: `w-[280px] min-w-[280px]`
- Conversation area: `flex-1`

#### Notifications Persistence
- On `setShowNotifications(false)` don't clear notifications
- On open, refetch from DB

#### Groups Members Count
- Fix `fetchMembers` to include pending=false filter
- Display `members.length` from local state

#### Profile — LinkedIn Style
- Add cover image section
- Add Experience, Skills, About sections
- Download CV functionality

---

## Verification Plan
- Run `npm run dev` and test each feature
- Test phone login with any number + `123456`
- Test job application modal flow
- Test media upload in messages and groups (verify sizing)
- Test notifications panel persistence
- Test profile edit and CV download
