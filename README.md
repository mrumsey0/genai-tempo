# Tempo
Tempo is an app that automates the process of finding time in your calendar to complete assignments.

## First Working Slice
The first working slice contains a pre-built calendar.
It allows a user to manually enter assignments with a title, description, and due date.
Tempo estimates the time to complete the assignment, with the option for the user to edit the estimate.
Then, it creates time blocks on the calendar to complete the assignment before the due date.

## Prototype Link
https://genai-tempo.replit.app
### Instructions
1. Click "Add assignment" button on top right
2. Fill out assignment details, then click "Estimate effort"
3. Review and edit estimate, then click "Schedule sessions"
4. Add more assignments to fill out calendar

## AI Behavior
The AI behavior is currently simulated. Right now, the estimate is 5 hours if the assignment title or description contains the word "essay", 30 minutes for "homework", or 1 hour if neither word appears.

## Three Test Cases
| Test                  | Input or action | What happened | Pass, partial, or fail |
|-----------------------|-----------------|---------------|------------------------|
| Typical case          | Essay assignment | 5 hour-long time blocks added to calendar | Pass |
| Challenge case        | Assignment added with not enough time to complete | Blocks calendar add | Partial, probably should allow add with warning |
| Invalid or empty case | Blank assignment | Does not allow to continue until title added | Pass |		

## Known Limitations
- As of now, there is no way for a user to use their own calendar. They just use a pre-built calendar for the purpose of the demo.
- The AI estimate is simulated. In the future, the estimate could factor in the title and description to make an intelligent estimate.
- There are no user accounts, and all data is saved locally in the browser.
