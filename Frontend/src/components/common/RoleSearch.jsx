import { useState, useRef, useEffect } from "react";
import { Search } from "lucide-react";
import { searchRoles } from "../../data/roles";

// Fix #17 + #18:
// - No suggestions until user types (removed onFocus showing all)
// - Mixed industries (roles.js already has them)
// - Fuzzy/partial matching, case-insensitive, spacing tolerant
// - Allow custom role if not in list
export default function RoleSearch({ value, onSelect, placeholder = "Type your target role..." }) {
  const [query, setQuery] = useState(value?.label || "");
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setOpen(false);
        // If user typed something not in list, allow it as custom role
        if (query.trim() && !results.find(r => r.label.toLowerCase() === query.toLowerCase())) {
          // keep as custom
        }
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [query, results]);

  const normalize = (str) =>
    str.toLowerCase().replace(/\s+/g, " ").trim();

  const handleChange = (e) => {

    const value = e.target.value;

    setQuery(value);

    if(!value.trim()){

        setResults([]);

        setOpen(false);

        onSelect(null);

        return;

    }

    const found = searchRoles(value);

    setResults(found);

    setOpen(found.length>0);

    const exact = found.find(

        role => role.label.toLowerCase() === value.toLowerCase()

    );

    if(exact){

        onSelect(exact);

    }else{

        onSelect({

            id:"custom",

            label:value.trim()

        });

    }
  };

  const handlePick = (role) => {
    setQuery(role.label);
    setOpen(false);
    setResults([]);
    onSelect(role);
  };

  return (
    <div ref={wrapRef} style={{ position: "relative", width: "100%" }}>
      <div className="centered-input" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <Search size={16} style={{ opacity: 0.6, flexShrink: 0 }} />
        <input
          type="text"
          value={query}
          onChange={handleChange}
          onKeyDown={(e)=>{
          
              if(e.key==="Enter"){
              
                  e.preventDefault();
              
              }
            
          }}
          placeholder={placeholder}
          autoComplete="off"
          style={{
              width:"100%",
              background:"transparent",
              border:"none",
              outline:"none"
          }}
        />
      </div>

      {open && results.length > 0 && (
        <ul
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            left: 0,
            right: 0,
            zIndex: 50,
            listStyle: "none",
            margin: 0,
            padding: "6px",
            borderRadius: "12px",
            border: "1px solid var(--border-primary)",
            background: "var(--bg-secondary)",
            boxShadow: "var(--shadow-lg)",
            maxHeight: "240px",
            overflowY: "auto",
          }}
        >
          {results.map((r) => (
            <li key={r.id}>
              <button
                type="button"
                onClick={() => handlePick(r)}
                style={{
                  width: "100%",
                  textAlign: "left",
                  padding: "9px 12px",
                  borderRadius: "8px",
                  background: "transparent",
                  color: "var(--text-primary)",
                  border: "none",
                  cursor: "pointer",
                  fontSize: "14px",
                  fontFamily: "inherit",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-hover-strong)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              >
                <span>{r.label}</span>
                <span style={{ fontSize: "11px", opacity: 0.45, textTransform: "capitalize" }}>{r.category}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
