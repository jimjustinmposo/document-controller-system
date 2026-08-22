# Document Controller System v2

Workflow: Receive → Check → Register → Upload → Route → Review → Approve → Issue → Control → Archive

## v2 features
- Back one workflow stage with confirmation
- Advance one workflow stage with confirmation
- Back/Advance actions are recorded in the audit trail
- Real file attachments stored under backend/uploads
- Revision-aware file storage; previous files are retained
- Document detail drawer with attachments, download, workflow history and audit trail
- SQLite database

## Run backend
```bat
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
python app.py
```
Backend: http://127.0.0.1:5000

## Run frontend (new terminal)
```bat
cd frontend
npm install
npm run dev
```
Open the Vite URL, normally http://localhost:5173
"# document-contoller-system" 
"# document-contoller-system" 
"# document-controller-system" 
