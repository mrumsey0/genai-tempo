# Tempo
**Description:** Tempo is an app that automates the process of finding time in your calendar to complete assignments.  
**Intended user:** graduate students at Notre Dame

# Prototype Link
https://genai-tempo.replit.app/

## Instructions
1. Click "Add calendar" button on top right to add public iCal calendar link or use sample calendar
2. Click "Add assignment" button on top right
3. Fill out assignment details, then click "Estimate effort"
4. Review and edit estimate, then click "Schedule sessions"
5. Add more assignments to fill out calendar

# Demo Video
https://drive.google.com/file/d/1IC2ggzzWXMOJEUYTDuU0zfvo4flzU9D7/view?usp=sharing

# AI Behavior
The AI behavior is currently simulated. Right now, the estimate is 5 hours if the assignment title or description contains the word "essay", 30 minutes for "homework", or 1 hour if neither word appears.

# Revision
## Improvements
1. Explanation of the time estimate, shown before work sessions are added to the calendar
2. Editing or deleting individual work sessions without deleting the whole assignment
3. Adding an assignment with a warning when there isn't enough time to complete it, instead of rejecting it
4. Importing the user's own calendar from a link

## Response to Peer Feedback
| Feedback or observed issue | Decision | What changed, or why it was deferred |
|----------------------------|----------|--------------------------------------|
| Add an explanation for the time estimate | Acted on | The app now shows an explanation of the time estimate before the sessions are added to the calendar |
| Allow users to edit or delete individual work sessions without deleting the whole assignment | Acted on | Users can now edit or delete individual work sessions without deleting the whole assignment |
| When there isn't enough time to finish an assignment, add it with a warning instead of rejecting it | Acted on | The assignment is now added to the calendar with a warning instead of being rejected |

# Evaluation
## Test Cases
| Case | Input or action | Expected result / success criterion | Actual result | Pass, partial, or fail | Implication or next step |
|------|-----------------|-------------------------------------|---------------|------------------------|--------------------------|
| Typical 1 | Essay assignment | 5 hour-long time blocks added to the calendar | 5 hour-long time blocks added to the calendar | Pass | |
| Typical 2 | Homework assignment | One 30-minute time block added to the calendar | One 30-minute time block added to the calendar | Pass | |
| Challenge | Assignment added with not enough time to complete | Assignment added to the calendar with a warning | Assignment added to the calendar with a warning | Pass | |
| Invalid or empty | Blank assignment | Does not allow the user to continue until a title is added | Does not allow the user to continue until a title is added | Pass | |
| Risk | Assignment added for 10-page essay | Estimate 10-15 hours | 5 hour-long time blocks added to the calendar | Fail | Implement actual AI functionality for more accurate estimates |

## Before and After
**Issue:** Assignment added with not enough time to complete (Challenge case)  
**Before:** The app blocked the assignment from being added. Partial.  
**After:** The assignment is added to the calendar with a warning. Pass.  
**Did the revision help?** Yes. The user now has more control over the assignments they add.

## What the Evidence Tells Us
Adding and editing assignments works reasonably well, and the user can now import a real calendar instead of using the sample one. The time estimate is still unreliable because the prototype is Wizard-of-Oz, with no real AI functionality behind it. The results partially support the value Tempo claims for its users: a plan to finish assignments on time without spending time making the plan. With real AI estimates, users will need to edit less, so that value will be fully realized. Next, I will implement a real AI estimate.

# Risk Response
A student could be affected if the time estimate is too low: they would not plan enough time for the assignment and could miss the due date because of it. The Risk test case shows this, where a 10-page essay was estimated at 5 hours. To respond to this risk, the user can manually edit the estimate given by the AI. The risk that remains is that the user trusts the AI's estimate too much and skips over the editing step. This connects to the course theme of over-reliance on AI: people still need to take the time to verify the AI's output.

# Known Limitations
- The AI functionality is still simulated.
- If a user does not have a public calendar link, they cannot add their own calendar events.

# Next Priorities
1. Add real AI estimate functionality
2. Allow the user to add calendar events in the app

# AI-Use Disclosure
## Tools Used
Replit, Claude Opus 5.5

## Development Assistance
Replit was used to develop the app. Claude assisted in drafting the README.

## Representative Prompts
**Prompt 1:** "Make the following updates: Show on the calendar where an assignment deadline is. Allow to delete or move an individual working session without needing to delete the whole assignment. After making the estimate, add a short explanation as to why that time estimate was made. Instead of denying a user to add an assignment where there is not enough time to complete before the deadline, give a warning and add any working sessions that you can before the deadline, but stop after the deadline."

**Prompt 2:** "Instead of the prebuilt calendar, start with a blank calendar. Add an add calendar button to the top. Give me the option to either import a calendar from a link or use the prebuilt sample calendar."

## Human Judgment
For the estimate explanation, the AI originally just described the criteria for the simulated estimate (for example, 5 hours because the word "essay" appeared in the description). I corrected it by asking it to give an explanation that makes it sound like a real estimate (with a disclaimer that the AI behavior is simulated).

## Verification
I tried importing a calendar, using the pre-built calendar, and adding assignments with the five test cases.

## AI Inside the Product
**Task:** Analyzes the assignment description to estimate the time required to complete it  
**Inputs:** Assignment name and description  
**Output:** Time estimate to complete assignment  
**Status:** All AI behavior is currently simulated
