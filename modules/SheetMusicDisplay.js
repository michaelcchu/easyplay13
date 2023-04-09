export default (() => {

    // i is the current note index
    let notes; let i; let tk; let mei; let staveData; let staveNumber;

    const val = {"c":0,"d":2,"e":4,"f":5,"g":7,"a":9,"b":11,"#":1,"&":-1,"":0};
    const accidentalVal = {null:0,"s":1,"f":-1,"ss":2,"x":2,"ff":-2,"xs":3,
    "sx":3,"ts":3,"tf":-3,"n":0,"nf":0,"ns":0,
    "su":0.75,"sd":0.25,"fu":-0.25,"fd":-0.75,"nu":0,"nd":0}
    const scrollableDiv = document.querySelector(".main");

    // Returns the pitch of the current note
    function getCurrentNote() {
        let playingNotes = document.querySelectorAll('g.note.playing');
        for (let playingNote of playingNotes) {
            const id = playingNote.getAttribute("id");
            const meiNote = mei.querySelector("[*|id='"+id+"']");
            let pitch = val[meiNote.getAttribute("pname")];
            const accidGes = meiNote.getAttribute("accid.ges");
            const accid = meiNote.getAttribute("accid");

            // handle cautionAccids
            const cautionAccids = meiNote.querySelectorAll("accid");
            for (let cautionAccid of cautionAccids) {
                const accidGes = cautionAccid.getAttribute("accid.ges");
                const accid = cautionAccid.getAttribute("accid");
                if (accid) {
                    pitch += accidentalVal[accid];
                } else {
                    pitch += accidentalVal[accidGes];
                }
            }

            // handle regular accids
            if (accid) {
                pitch += accidentalVal[accid];
            } else {
                pitch += accidentalVal[accidGes];
            }

            const note = {
                pitch: pitch,
                octave: +meiNote.getAttribute("oct")
            }
            return note;
        }
    }

    function unhighlightCurrentNote() {
        // Remove the attribute 'playing' of all notes previously playing
        for (let name of ['notehead','note']) {
            let playingNotes = document.querySelectorAll('g.'+name+'.playing');
            for (let playingNote of playingNotes) {
                playingNote.classList.remove("playing");
            }
        }
    }

    function scrollToNote(note) {
        const notehead = note.querySelector('.notehead')
        const bbox = notehead.getBBox();
        const svg = document.querySelector('svg');
        const point = svg.createSVGPoint();
        point.x = bbox.x;
        point.y = bbox.y;

        const ctm = notehead.getScreenCTM();
        const newPoint = point.matrixTransform(ctm);
        const x = newPoint.x
        const y = newPoint.y

        const divPosition = scrollableDiv.getBoundingClientRect();
        const midX = (divPosition.left + divPosition.right) / 2
        const midY = (divPosition.top + divPosition.bottom) / 2

        if (x < midX) {scrollableDiv.scrollLeft -= midX - x} 
        else if (x > midX) {scrollableDiv.scrollLeft += x - midX}
        if (y < midY) {scrollableDiv.scrollTop -= midY - y} 
        else if (y > midY) {scrollableDiv.scrollTop += y - midY}
    }

    function scrollToCurrentNote() {
        if (notes.length > 0) {
            let noteIndex;
            if (i < 0) { noteIndex = 0; }
            else if (i >= notes.length) {noteIndex = notes.length - 1;}
            else {
                noteIndex = i; 
                const id = notes[i].getAttribute("xml:id");
                const note = document.getElementById(id);
                const notehead = note.querySelector('.notehead');
                note.classList.add("playing");
                notehead.classList.add("playing");
            }
            const meiNote = notes[noteIndex];
            const id = meiNote.getAttribute("xml:id");
            const svgNote = document.getElementById(id);
            scrollToNote(svgNote);
        }  
    }

    function goToNextNote() {
        unhighlightCurrentNote();
        if (i < notes.length) {
            i++;
            if (i < notes.length) {scrollToCurrentNote();}
        }
    }

    function goToPreviousNote() {
        unhighlightCurrentNote();
        if (i >= 0) {
            i--;
            if (i >= 0) {scrollToCurrentNote();}
        }
    }

    function main() {
        const input = document.getElementById("input");
        input.addEventListener("change", readFile);
    
        const go = document.getElementById("go");
        go.addEventListener("click", goToMeasure);

        const library = document.getElementById("library");
        // Set library options
        let optgroup = document.createElement("optgroup");
        optgroup.label = "Chorales";
        for (let i = 1; i <= 371; i++) {
            const option = document.createElement("option");
            option.text = i; optgroup.append(option);
        }
        library.add(optgroup);

        optgroup = document.createElement("optgroup");
        optgroup.label = "Well-Tempered Clavier Book 1";
        for (let i = 1; i <= 12; i++) {
            const option = document.createElement("option");
            option.text = i; optgroup.append(option);
        }
        library.add(optgroup);

        library.addEventListener("change", loadChorale);

        const select = document.getElementById("select");
        select.addEventListener("change", setTrack);

        const zoomFactor = document.getElementById("zoomFactor");
        zoomFactor.addEventListener("change", setZoom);

        tk = new verovio.toolkit();
        console.log("Verovio has loaded!"); 

        tk.setOptions({
            breaks: "none",
            mnumInterval: 1,
            scale: +zoomFactor.value
        });

        function setup() {
            // Render the SVG
            document.getElementById("container").innerHTML = tk.renderToSVG(1);
            
            // Get the MEI
            const meiContent = tk.getMEI();
            const parser = new DOMParser();
            mei = parser.parseFromString(meiContent, "text/xml");
            console.log(mei);

            // Find notes by stave
            staveData = {};
            const staves = mei.querySelectorAll('staff');
            for (let stave of staves) {
                const n = stave.getAttribute("n");
                if (!(n in staveData)) {staveData[n] = [];}
                const notes = stave.querySelectorAll('note');
                for (let note of notes) {staveData[n].push(note);}
            }

            // Remove tied notes
            const ties = mei.querySelectorAll("tie");
            for (const tie of ties) {
                const skipNoteId = tie.getAttribute("endid").slice(1);
                for (let key in staveData) {
                    const stave = staveData[key];
                    const skipNoteIndex = stave.findIndex((note) => {
                        return (note.getAttribute("xml:id") === skipNoteId);
                    });
                    if (skipNoteIndex > -1) {
                        stave.splice(skipNoteIndex, 1);
                    }
                } 

            }

            // Set part options
            while (select.options.length) {select.options.remove(0);}
            for (let key in staveData) {
                const option = document.createElement("option");
                option.text = key; select.add(option);
            }

            setTrack();
        }
    
        loadChorale();

        // code for left and right navigation buttons
        let interval;
        let cleanSlate = true;
        let timeoutInProgress = false;

        function repeat(f) {
            if (cleanSlate) {
                f();
                if (!timeoutInProgress) {
                    cleanSlate = false;
                    setTimeout(() => {
                        if (!cleanSlate) {
                            interval = setInterval(f, 200);
                        }
                        timeoutInProgress = false;
                    }, 400);
                    timeoutInProgress = true;    
                }
            }
        }

        function stopMoving() {
            clearInterval(interval); cleanSlate = true;
        }

        const left = document.getElementById("move-left");
        left.addEventListener("pointerdown", () => {repeat(goToPreviousNote);});
        left.addEventListener("pointerup", stopMoving);

        const right = document.getElementById("move-right");
        right.addEventListener("pointerdown", () => {repeat(goToNextNote);});
        right.addEventListener("pointerup", stopMoving);

        document.addEventListener("keydown", moveCursor);

        function loadChorale() {
            let choraleNumber = library.options[library.selectedIndex].text;
            choraleNumber = ("00" + choraleNumber).slice(-3);
            // const url = "./data/Beethoven__Symphony_No._9__Op._125-Clarinetto_1_in_C_(Clarinet).mxl";
            // const url = "https://kern.humdrum.org/cgi-bin/ksdata?file=chor001.krn&l=users/craig/classical/bach/371chorales&format=kern";
            const url = "https://raw.githubusercontent.com/craigsapp/bach-370-chorales/master/kern/chor" 
                + choraleNumber + ".krn";

            fetch(url)
            .then( response => {
                if (url.endsWith(".musicxml") || url.endsWith(".xml") ||
                url.endsWith(".mei") || url.endsWith(".krn")) {
                    return response.text();
                } else if (url.endsWith(".mxl")) {
                    return response.arrayBuffer(); 
                } 
            })
            .then( data => {
                if (url.endsWith(".musicxml") || url.endsWith(".xml") ||
                url.endsWith(".mei") || url.endsWith(".krn")) {
                    tk.loadData(data);
                } else if (url.endsWith(".mxl")) {
                    tk.loadZipDataBuffer(data); 
                }
                setup();
            })
            .catch( e => {console.log( e );} );            
        }
        
        function setTrack() {
            i = -1;

            unhighlightCurrentNote();

            staveNumber = select.options[select.selectedIndex].text;
            notes = staveData[staveNumber];
            
            scrollToCurrentNote();
        }
    
        function getMeasure(note) {
            const number = note.closest("measure").getAttribute("n");
            if (number !== null) {return +number;}
            else {return number;}
        }

        function goToMeasure() {
            const measureInput = document.getElementById("measureInput");
            let measure = +measureInput.value;
            if (measure && notes.length > 0) {
                unhighlightCurrentNote();

                const lastMeasure = getMeasure(notes[notes.length - 1]);
                if (measure > lastMeasure) {
                    measure = lastMeasure;
                }

                function getCurrentMeasure() {
                    if (i < 0) {
                        if (notes.length > 0) {
                            return -1;
                        } else {
                            return undefined;
                        }
                    } else if (i >= notes.length) {
                        if (notes.length > 0) {
                            return getMeasure(notes[notes.length - 1]);
                        } else {
                            return undefined;
                        }
                    } else {
                        return getMeasure(notes[i]);
                    }
                }

                function condition(a) {
                    const current = getCurrentMeasure();
                    return (current === null) || 
                            (a * (measure - current) > 0);
                }

                while (condition(1)) {i++;}
                while (condition(-1)) {i--;}
                
                scrollToCurrentNote();  
            }

            document.activeElement.blur();
        }

        function moveCursor(e) {
            if (document.activeElement.nodeName !== 'INPUT') {
                if (e.key === "ArrowLeft") {goToPreviousNote();}
                else if (e.key === "ArrowRight") {goToNextNote();}
            }   
        }
    
        function readFile() {    
            for (const file of input.files) {
                const reader = new FileReader();
                const name = file.name.toLowerCase();
                if (name.endsWith(".musicxml") || name.endsWith(".xml") ||
                    name.endsWith(".mei") || name.endsWith(".krn")) {
                    reader.addEventListener("load", (e) => {
                        tk.loadData(e.target.result);
                        setup();
                    });
                    reader.readAsText(file);
                } else if (name.endsWith(".mxl")) {
                    reader.addEventListener("load", (e) => {
                        tk.loadZipDataBuffer(e.target.result);
                        setup();
                    });
                    reader.readAsArrayBuffer(file);
                }
            }
        }

        function setZoom() {
            tk.setOptions({scale: +zoomFactor.value});
            document.getElementById("container").innerHTML = tk.renderToSVG(1);
            setTimeout(scrollToCurrentNote, 0);
            document.activeElement.blur(); 
        }

        // Turn off default event listeners
        const ets = ['focus', 'pointerover', 'pointerenter', 'pointerdown', 
            'touchstart', 'gotpointercapture', 'pointermove', 'touchmove', 
            'pointerup', 'lostpointercapture', 'pointerout', 'pointerleave', 
            'touchend'];
        for (let et of ets) {
            left.addEventListener(et, function(event) {
                event.preventDefault();
                event.stopPropagation();
            }, false);
            right.addEventListener(et, function(event) {
                event.preventDefault();
                event.stopPropagation();
            }, false); 
        }

    }

    const body = document.getElementsByTagName('body')[0];
    const script = document.createElement('script');
    script.src ="./verovio-toolkit-hum.js";
    script.onload = () => {verovio.module.onRuntimeInitialized = main;}
    body.appendChild(script);

    return {
        getCurrentNote: getCurrentNote,
        goToNextNote: goToNextNote
    };
})();
