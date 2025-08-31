#Ai4GP mobile

You are a professional software developer with experience in Android mobile development.  You are using the latest technology and focused on versions as 2025. We need to analyse and decide which parts of ai4GP to include in the mobile app ai4GPapp.  

The current modules that we think are relevant:
1, library functionality organied for fast access on mobile, using semantic search with FAISS but on mobile, so a searched for string or comment brings up the relevant information.  

2, Transcription:  Create an Android version of the transcription service accessing gemini flash, or on device AI transcription, with gemini or selected URL for processing of the recording. Provide a way to manage the processing options and update them. Design a way to connect the mobile app with ai4GP such that a staff member can upload the content from their phone to the appropriate patient in the ai4GP at thier office.  This will require discussion of multiple options, and a clarification on security, and 2FA etc to ensure data security.

3, Patient monitoriing.  Create a version for Android table which uses android xml layout to create a tablets which displays all the information from the patient monitoring clearly on the tablet screen.  Design the ability to move between information on the tablet.

The current features we want to incluce:
* Mobile phone triage.  This would be a module that can be used to answer phone calls on the device.  This would bring up the recording and transcription of the phonecall, and present the triage system onscreen.  The system would connect to the AI based audio transcrition system in Android, and use that to drive the suggested triage questions.  This would be shown with the top half of the screen being the current triage questions, with the bottom half being suggestion for areas based on the current item and the transcription of the call.  When a patient on the call mentions chest pain then the system should highlight triage questions related to heart attach and chest pain. The sections for triage questions should be shown in the bottom half of the page.
This will require planning the module, getting permission to use onboard AI for live transcription

the checklist for development need to have sections and subsections.  Each task needs a checkbox with meaning: [ ] todo; [~] currently working on/partially implemented; [?] needing to be reviewed; [X] done.  

