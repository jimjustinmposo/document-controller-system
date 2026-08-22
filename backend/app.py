from flask import Flask, jsonify, request, send_file
from flask_cors import CORS
import sqlite3
from pathlib import Path
from datetime import datetime
from werkzeug.utils import secure_filename

BASE = Path(__file__).resolve().parent
DB = BASE / 'document_controller.db'
UPLOADS = BASE / 'uploads'
UPLOADS.mkdir(exist_ok=True)
app = Flask(__name__)
CORS(app)
STAGES = ['Receive','Check','Register','Upload','Route','Review','Approve','Issue','Control','Archive']
STATUS = {'Receive':'Received','Check':'Checking','Register':'Registered','Upload':'Uploaded','Route':'Routed','Review':'Under Review','Approve':'Pending Approval','Issue':'Issued','Control':'Controlled','Archive':'Archived'}

def now(): return datetime.now().isoformat(timespec='seconds')
def conn():
    c=sqlite3.connect(DB); c.row_factory=sqlite3.Row; return c

def init():
    c=conn(); c.executescript('''
    CREATE TABLE IF NOT EXISTS documents(id INTEGER PRIMARY KEY AUTOINCREMENT,document_no TEXT UNIQUE NOT NULL,title TEXT NOT NULL,project TEXT,discipline TEXT,originator TEXT,revision TEXT DEFAULT 'A',status TEXT NOT NULL,current_stage TEXT NOT NULL,received_date TEXT,due_date TEXT,description TEXT,created_at TEXT NOT NULL,updated_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS files(id INTEGER PRIMARY KEY AUTOINCREMENT,document_id INTEGER NOT NULL,revision TEXT NOT NULL,file_name TEXT NOT NULL,stored_path TEXT NOT NULL,file_size INTEGER,uploaded_by TEXT,created_at TEXT NOT NULL,active INTEGER DEFAULT 1,FOREIGN KEY(document_id) REFERENCES documents(id));
    CREATE TABLE IF NOT EXISTS activity(id INTEGER PRIMARY KEY AUTOINCREMENT,document_id INTEGER NOT NULL,stage TEXT NOT NULL,action TEXT NOT NULL,actor TEXT,remarks TEXT,created_at TEXT NOT NULL,FOREIGN KEY(document_id) REFERENCES documents(id));
    '''); c.commit(); c.close()

def log(c,did,stage,action,actor='Document Controller',remarks=''):
    c.execute('INSERT INTO activity(document_id,stage,action,actor,remarks,created_at) VALUES(?,?,?,?,?,?)',(did,stage,action,actor,remarks,now()))

def doc_json(r): return dict(r) if r else None

@app.get('/api/health')
def health(): return jsonify({'ok':True,'workflow':STAGES})

@app.get('/api/dashboard')
def dashboard():
    c=conn(); total=c.execute('SELECT COUNT(*) n FROM documents').fetchone()['n']; rows=c.execute('SELECT current_stage,COUNT(*) n FROM documents GROUP BY current_stage').fetchall(); stages={s:0 for s in STAGES}
    for r in rows: stages[r['current_stage']]=r['n']
    recent=[dict(x) for x in c.execute('SELECT * FROM documents ORDER BY updated_at DESC LIMIT 8').fetchall()]; c.close(); return jsonify({'total':total,'stages':stages,'recent':recent})

@app.get('/api/documents')
def documents():
    c=conn(); rows=c.execute('SELECT * FROM documents ORDER BY updated_at DESC').fetchall(); c.close(); return jsonify([dict(r) for r in rows])

@app.post('/api/documents')
def create_document():
    d=request.get_json(force=True); t=now()
    if not d.get('document_no') or not d.get('title'): return jsonify(error='document_no and title are required'),400
    c=conn()
    try:
        cur=c.execute('''INSERT INTO documents(document_no,title,project,discipline,originator,revision,status,current_stage,received_date,due_date,description,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)''',(d['document_no'],d['title'],d.get('project',''),d.get('discipline',''),d.get('originator',''),d.get('revision','A'),'Received','Receive',d.get('received_date',t[:10]),d.get('due_date',''),d.get('description',''),t,t)); log(c,cur.lastrowid,'Receive','Document received'); c.commit(); did=cur.lastrowid
    except sqlite3.IntegrityError: c.close(); return jsonify(error='Document number already exists'),409
    c.close(); return jsonify(id=did),201

@app.get('/api/documents/<int:did>')
def document_detail(did):
    c=conn(); d=c.execute('SELECT * FROM documents WHERE id=?',(did,)).fetchone();
    if not d: c.close(); return jsonify(error='Document not found'),404
    files=[dict(x) for x in c.execute('SELECT * FROM files WHERE document_id=? ORDER BY created_at DESC',(did,)).fetchall()]
    activity=[dict(x) for x in c.execute('SELECT * FROM activity WHERE document_id=? ORDER BY created_at DESC',(did,)).fetchall()]; c.close()
    return jsonify({'document':dict(d),'files':files,'activity':activity})

def move(did,direction):
    d=request.get_json(silent=True) or {}; c=conn(); doc=c.execute('SELECT * FROM documents WHERE id=?',(did,)).fetchone()
    if not doc: c.close(); return jsonify(error='Document not found'),404
    i=STAGES.index(doc['current_stage']); target=i+(1 if direction=='forward' else -1)
    if target<0: c.close(); return jsonify(error='Already at Receive'),400
    if target>=len(STAGES): c.close(); return jsonify(error='Already archived'),400
    ns=STAGES[target]; t=now(); c.execute('UPDATE documents SET current_stage=?,status=?,updated_at=? WHERE id=?',(ns,STATUS[ns],t,did))
    action=d.get('action') or (f"Moved forward: {doc['current_stage']} → {ns}" if direction=='forward' else f"Moved back: {doc['current_stage']} → {ns}")
    log(c,did,ns,action,d.get('actor','Document Controller'),d.get('remarks','')); c.commit(); c.close(); return jsonify(ok=True,from_stage=doc['current_stage'],stage=ns)

@app.post('/api/documents/<int:did>/advance')
def advance(did): return move(did,'forward')
@app.post('/api/documents/<int:did>/back')
def back(did): return move(did,'back')

@app.post('/api/documents/<int:did>/upload')
def upload(did):
    f=request.files.get('file'); rev=request.form.get('revision','A'); actor=request.form.get('actor','Document Controller')
    if not f or not f.filename: return jsonify(error='No file supplied'),400
    c=conn(); doc=c.execute('SELECT * FROM documents WHERE id=?',(did,)).fetchone()
    if not doc: c.close(); return jsonify(error='Document not found'),404
    name=secure_filename(f.filename); folder=UPLOADS/f'DOC-{did}'/f'Rev-{secure_filename(rev)}'; folder.mkdir(parents=True,exist_ok=True); path=folder/name; f.save(path)
    c.execute('UPDATE files SET active=0 WHERE document_id=? AND revision=?',(did,rev)); c.execute('INSERT INTO files(document_id,revision,file_name,stored_path,file_size,uploaded_by,created_at,active) VALUES(?,?,?,?,?,?,?,1)',(did,rev,name,str(path.relative_to(BASE)),path.stat().st_size,actor,now())); c.execute('UPDATE documents SET revision=?,current_stage=?,status=?,updated_at=? WHERE id=?',(rev,'Upload','Uploaded',now(),did)); log(c,did,'Upload',f'File uploaded: {name}',actor,f'Revision {rev}'); c.commit(); c.close(); return jsonify(ok=True,file_name=name,revision=rev)

@app.get('/api/files/<int:file_id>/download')
def download(file_id):
    c=conn(); f=c.execute('SELECT * FROM files WHERE id=?',(file_id,)).fetchone(); c.close()
    if not f: return jsonify(error='File not found'),404
    path=BASE/f['stored_path']
    if not path.exists(): return jsonify(error='Stored file missing'),404
    return send_file(path,as_attachment=True,download_name=f['file_name'])

init()
if __name__=='__main__': app.run(host='127.0.0.1',port=5000,debug=True)
