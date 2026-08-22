import React,{useEffect,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {LayoutDashboard,FileText,Inbox,Archive,Plus,Search,ChevronRight,Upload,Clock,Eye,Download,ArrowLeft} from 'lucide-react';
import './styles.css';

const API='http://127.0.0.1:5000/api';
const STAGES=['Receive','Check','Register','Upload','Route','Review','Approve','Issue','Control','Archive'];

function App(){
  const [tab,setTab]=useState('Dashboard');
  const [dash,setDash]=useState(null);
  const [docs,setDocs]=useState([]);
  const [selected,setSelected]=useState(null);
  const [form,setForm]=useState(false);
  const [search,setSearch]=useState('');

  const load=async()=>{
    setDash(await (await fetch(API+'/dashboard')).json());
    setDocs(await (await fetch(API+'/documents')).json());
  };

  useEffect(()=>{
    load();
  },[]);

  const move=async(id,dir)=>{

    if(
      !window.confirm(
        dir==='forward'
          ?'Advance this document one stage?'
          :'Move this document back one stage?'
      )
    )return;

    try{

      const response=await fetch(
        `${API}/documents/${id}/${dir==='forward'?'advance':'back'}`,
        {
          method:'POST',
          headers:{
            'Content-Type':'application/json'
          },
          body:'{}'
        }
      );

      if(!response.ok){
        const err=await response.json();
        alert(err.error||'Unable to update document.');
        return;
      }

    }catch(err){

      console.error(err);

      alert('Unable to contact the server.');

    }

  };

  // Refresh first so the list shows the previous move,
  // then apply this move. No auto-refresh afterwards -
  // the next Back/Advance click picks up the result.
  const moveWithRefresh=async(id,dir)=>{
    await load();
    await move(id,dir);
  };

  const create=async e=>{
    e.preventDefault();

    const d=Object.fromEntries(new FormData(e.target));

    await fetch(API+'/documents',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify(d)
    });

    setForm(false);
    load();
  };

  const filtered=docs.filter(d=>
    Object.values(d)
      .join(' ')
      .toLowerCase()
      .includes(search.toLowerCase())
  );

  return (
    <div className="app">

      <aside>
        <div className="brand">
          <div className="logo">DC</div>
          <div>
            <b>DocControl</b>
            <small>Document Management</small>
          </div>
        </div>

        <nav>
          {[
            ['Dashboard',LayoutDashboard],
            ['Documents',FileText],
            ['Receive',Inbox],
            ['Archive',Archive]
          ].map(([n,I])=>(
            <button
              key={n}
              className={tab===n?'active':''}
              onClick={()=>setTab(n)}
            >
              <I size={18}/>
              <span>{n}</span>
            </button>
          ))}
        </nav>
      </aside>

      <main>
        <header>
          <div>
            <h1>{tab}</h1>
            <p>
              Receive → Check → Register → Upload → Route → Review → Approve → Issue → Control → Archive
            </p>
          </div>

          <div className="head">
            <div className="search">
              <Search size={16}/>
              <input
                placeholder="Search documents..."
                value={search}
                onChange={e=>setSearch(e.target.value)}
              />
            </div>

            <button
              className="primary"
              onClick={()=>setForm(true)}
            >
              <Plus size={17}/>
              New Document
            </button>
          </div>
        </header>

        {tab==='Dashboard'
          ?
          <Dashboard
            dash={dash}
            docs={docs}
            open={setSelected}
          />
          :
          <Documents
            docs={filtered}
            move={moveWithRefresh}
            open={setSelected}
          />
        }
      </main>

      {form &&
        <Modal
          create={create}
          close={()=>setForm(false)}
        />
      }

      {selected &&
        <Detail
          id={selected.id}
          close={()=>setSelected(null)}
          move={move}
        />
      }

    </div>
  );
}

function Dashboard({dash,docs,open}){
  if(!dash)
    return <div className="loading">Loading…</div>;

  return (
    <div>

      <div className="stats">
        <Card n={dash.total} t="Total Documents"/>
        <Card n={dash.stages.Check||0} t="Pending Check"/>
        <Card n={dash.stages.Review||0} t="Under Review"/>
        <Card n={dash.stages.Approve||0} t="Pending Approval"/>
      </div>

      <section className="panel">
        <h2>Document Workflow</h2>

        <p className="muted">
          Live document movement through the control process.
        </p>

        <div className="workflow">
          {STAGES.map((s,i)=>(
            <React.Fragment key={s}>
              <div className="stage">
                <div className="bubble">{i+1}</div>
                <b>{s}</b>
                <small>{dash.stages[s]||0}</small>
              </div>

              {i<9 &&
                <ChevronRight
                  className="arrow"
                  size={16}
                />
              }
            </React.Fragment>
          ))}
        </div>
      </section>

      <section className="panel">
        <div className="panelTitle">
          <h2>Recent Documents</h2>
        </div>

        <Table
          docs={docs.slice(0,7)}
          open={open}
        />
      </section>

    </div>
  );
}

function Card({n,t}){
  return (
    <div className="card">
      <span>{t}</span>
      <strong>{n}</strong>
    </div>
  );
}

function Documents({docs,move,open}){
  return (
    <section className="panel mainPanel">

      <div className="panelTitle">
        <div>
          <h2>Document Register</h2>

          <p className="muted">
            Select a document to view files, revisions and audit history.
          </p>
        </div>
      </div>

      <Table
        docs={docs}
        move={move}
        open={open}
      />

    </section>
  );
}

function Table({docs,move,open}){
  return (
    <div className="tableWrap">

      <table>

        <thead>
          <tr>
            <th>Document</th>
            <th>Project</th>
            <th>Rev</th>
            <th>Stage</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>

        <tbody>

          {docs.map(d=>(
            <tr key={`${d.id}-${d.current_stage}-${d.revision}`}>

              <td
                onClick={()=>open(d)}
                className="click"
              >
                <b>{d.document_no}</b>
                <small>{d.title}</small>
              </td>

              <td>{d.project||'—'}</td>

              <td>Rev {d.revision}</td>

              <td>
                <span className="badge blue">
                  {d.current_stage}
                </span>
              </td>

              <td>
                <span className="badge">
                  {d.status}
                </span>
              </td>

              <td className="actions">

                {move && d.current_stage!=='Receive' &&
                  <button
                    className="backBtn"
                    onClick={()=>move(d.id,'back')}
                  >
                    ← Back
                  </button>
                }

                {move && d.current_stage!=='Archive' &&
                  <button
                    className="next"
                    onClick={()=>move(d.id,'forward')}
                  >
                    Advance
                    <ChevronRight size={14}/>
                  </button>
                }

                <button
                  className="iconBtn"
                  onClick={()=>open(d)}
                >
                  <Eye size={15}/>
                </button>

              </td>

            </tr>
          ))}

          {!docs.length &&
            <tr>
              <td
                colSpan="6"
                className="empty"
              >
                No documents found.
              </td>
            </tr>
          }

        </tbody>

      </table>

    </div>
  );
}

function Modal({create,close}){
  return (
    <div className="overlay">

      <form
        className="modal"
        onSubmit={create}
      >

        <div className="modalTop">
          <h2>Receive New Document</h2>

          <button
            type="button"
            onClick={close}
          >
            ×
          </button>
        </div>

        <div className="grid">

          <label>
            Document No.*
            <input
              name="document_no"
              required
              placeholder="DOC-001"
            />
          </label>

          <label>
            Title*
            <input
              name="title"
              required
            />
          </label>

          <label>
            Project
            <input name="project"/>
          </label>

          <label>
            Discipline
            <input name="discipline"/>
          </label>

          <label>
            Originator
            <input name="originator"/>
          </label>

          <label>
            Revision
            <input
              name="revision"
              defaultValue="A"
            />
          </label>

          <label>
            Received Date
            <input
              type="date"
              name="received_date"
            />
          </label>

          <label>
            Due Date
            <input
              type="date"
              name="due_date"
            />
          </label>

        </div>

        <label>
          Description
          <textarea
            name="description"
            rows="3"
          />
        </label>

        <button
          className="primary full"
          type="submit"
        >
          Receive Document
        </button>

      </form>

    </div>
  );
}

function Detail({id,close,move}){

  const [data,setData]=useState(null);
  const [file,setFile]=useState(null);
  const [rev,setRev]=useState('A');
  const [busy,setBusy]=useState(false);

  const load=()=>{
    return fetch(`${API}/documents/${id}`)
      .then(r=>r.json())
      .then(setData);
  };

  useEffect(load,[id]);

  const doMove=async dir=>{

    if(busy)return;

    setBusy(true);

    try{

      await load();
      await move(id,dir);

    }finally{

      setBusy(false);

    }

  };

  if(!data){
    return (
      <div className="overlay">
        <div className="drawer">
          Loading…
        </div>
      </div>
    );
  }

  const d=data.document;

  const upload=async()=>{
    if(!file)
      return alert('Choose a file first');

    const fd=new FormData();

    fd.append('file',file);
    fd.append('revision',rev);

    await fetch(
      `${API}/documents/${id}/upload`,
      {
        method:'POST',
        body:fd
      }
    );

    setFile(null);
    load();
  };

  return (
    <div className="overlay">

      <div className="drawer">

        <div className="drawerTop">

          <button
            className="iconBtn"
            onClick={close}
          >
            <ArrowLeft size={18}/>
          </button>

          <div>
            <h2>{d.document_no}</h2>
            <p>{d.title}</p>
          </div>

          <span className="badge blue">
            {d.current_stage}
          </span>

        </div>

        <div className="controls">

          {d.current_stage!=='Receive' &&
            <button
              className="backBtn"
              disabled={busy}
              onClick={()=>doMove('back')}
            >
              ← Back
            </button>
          }

          {d.current_stage!=='Archive' &&
            <button
              className="next"
              disabled={busy}
              onClick={()=>doMove('forward')}
            >
              Advance →
            </button>
          }

        </div>

        <div className="detailGrid">

          <div>
            <b>Project</b>
            <span>{d.project||'—'}</span>
          </div>

          <div>
            <b>Discipline</b>
            <span>{d.discipline||'—'}</span>
          </div>

          <div>
            <b>Originator</b>
            <span>{d.originator||'—'}</span>
          </div>

          <div>
            <b>Revision</b>
            <span>Rev {d.revision}</span>
          </div>

        </div>

        <section className="sub">

          <h3>Attachments</h3>

          <div className="upload">

            <input
              type="file"
              onChange={e=>setFile(e.target.files[0])}
            />

            <input
              value={rev}
              onChange={e=>setRev(e.target.value)}
              placeholder="Revision"
            />

            <button
              className="primary"
              onClick={upload}
            >
              <Upload size={15}/>
              Upload
            </button>

          </div>

          {data.files.map(f=>(
            <div
              className="file"
              key={f.id}
            >

              <FileText size={20}/>

              <div>
                <b>{f.file_name}</b>

                <small>
                  Rev {f.revision} · {(f.file_size/1024/1024).toFixed(2)} MB · {f.uploaded_by||'Document Controller'}
                </small>
              </div>

              <a
                href={`${API}/files/${f.id}/download`}
              >
                <Download size={16}/>
              </a>

            </div>
          ))}

        </section>

        <section className="sub">

          <h3>Workflow History</h3>

          {STAGES.map(s=>(
            <div
              className="timeline"
              key={s}
            >

              <span
                className={
                  s===d.current_stage
                    ? 'dot current'
                    : 'dot'
                }
              />

              <b>{s}</b>

              <small>
                {data.activity.find(a=>a.stage===s)?.action||'Pending'}
              </small>

            </div>
          ))}

        </section>

        <section className="sub">

          <h3>Audit Trail</h3>

          {data.activity.map(a=>(
            <div
              className="audit"
              key={a.id}
            >

              <Clock size={14}/>

              <span>
                {a.action}

                <small>
                  {a.created_at} · {a.actor}
                </small>
              </span>

            </div>
          ))}

        </section>

      </div>

    </div>
  );
}

createRoot(
  document.getElementById('root')
).render(
  <App/>
);