
const AnimationModule = (() => {

    let currentSolution = null;
    let slides = [];
    let currentSlideIndex = 0;


    let overlay, header, content, controls;
    let stage, instructionBox, progressBar;
    let prevBtn, nextBtn, closeBtn, replayBtn;
    let chatBtn, chatBubble, chatInput, chatSend, chatMessages;


    function init() {
        createOverlay();


        prevBtn.addEventListener('click', prevStep);
        nextBtn.addEventListener('click', nextStep);
        closeBtn.addEventListener('click', closeOverlay);
        replayBtn.addEventListener('click', replayStep);


        document.addEventListener('keydown', (e) => {
            if (overlay.style.display === 'flex') {
                if (e.key === 'ArrowRight') nextStep();
                if (e.key === 'ArrowLeft') prevStep();
                if (e.key === 'Escape') closeOverlay();
            }
        });
    }

    function createOverlay() {
        const div = document.createElement('div');
        div.className = 'animation-overlay';
        div.style.display = 'none';
        div.innerHTML = `
      <div class="animation-header">
        <div class="animation-title">Step-by-Step Solver</div>
        <button class="btn-icon" id="animCloseBtn">✕</button>
      </div>
      <div class="animation-content">
        <div class="animation-stage" id="animStage"></div>
        <div class="animation-instruction" id="animInstruction"></div>
        
        <!-- Chat Bubble -->
        <div class="anim-chat-container">
            <button class="anim-chat-btn" id="animChatBtn" title="Ask a question about this step">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                </svg>
            </button>
            <div class="anim-chat-bubble" id="animChatBubble" style="display:none;">
                <div class="anim-chat-messages" id="animChatMessages"></div>
                <div class="anim-chat-input-area">
                    <input type="text" id="animChatInput" placeholder="Ask about this step..." />
                    <button id="animChatSend">→</button>
                </div>
            </div>
        </div>
      </div>
      <div class="animation-controls">
        <button class="control-btn" id="animPrevBtn" title="Previous Step">←</button>
        <button class="control-btn" id="animReplayBtn" title="Replay Step">⟳</button>
        <button class="control-btn" id="animNextBtn" title="Next Step">→</button>
      </div>
      <div class="progress-bar" id="animProgressBar"></div>
    `;
        document.body.appendChild(div);

        overlay = div;
        stage = div.querySelector('#animStage');
        instructionBox = div.querySelector('#animInstruction');
        progressBar = div.querySelector('#animProgressBar');
        prevBtn = div.querySelector('#animPrevBtn');
        nextBtn = div.querySelector('#animNextBtn');
        closeBtn = div.querySelector('#animCloseBtn');
        replayBtn = div.querySelector('#animReplayBtn');

        chatBtn = div.querySelector('#animChatBtn');
        chatBubble = div.querySelector('#animChatBubble');
        chatInput = div.querySelector('#animChatInput');
        chatSend = div.querySelector('#animChatSend');
        chatMessages = div.querySelector('#animChatMessages');


        chatBtn.addEventListener('click', toggleChat);
        chatSend.addEventListener('click', sendQuestion);
        chatInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') sendQuestion();
        });
    }

    function toggleChat() {
        if (chatBubble.style.display === 'none') {
            chatBubble.style.display = 'flex';
            chatInput.focus();
        } else {
            chatBubble.style.display = 'none';
        }
    }

    async function sendQuestion() {
        const q = chatInput.value.trim();
        if (!q || !currentSolution) return;


        addMessage('user', q);
        chatInput.value = '';


        const loadingId = addMessage('assistant', '...');

        try {

            const currentSlide = slides[currentSlideIndex];
            const stepIndex = currentSlide ? (currentSlide.stepIndex || 0) : 0;
            const step = currentSolution.steps[stepIndex];
            const totalSteps = currentSolution.steps.length;

            const problemText = document.getElementById('mathInput') ? document.getElementById('mathInput').value : '';

            const response = await fetch('/mathnote/api/ask_step', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    question: q,
                    step: step,
                    stepNumber: stepIndex + 1,
                    totalSteps: totalSteps,
                    slideType: currentSlide ? currentSlide.type : 'equation',
                    problem: problemText,
                    lang: document.documentElement.getAttribute('data-lang') || 'en'
                })
            });

            const data = await response.json();


            const loadingMsg = document.getElementById(loadingId);
            if (loadingMsg) loadingMsg.remove();

            addMessage('assistant', data.answer);

        } catch (err) {
            console.error(err);
            const loadingMsg = document.getElementById(loadingId);
            if (loadingMsg) loadingMsg.textContent = 'Error getting answer.';
        }
    }

    function addMessage(role, text) {
        const div = document.createElement('div');
        div.className = `chat-msg ${role}`;
        if (role === 'user') {
            div.textContent = text;
        } else {
            div.innerHTML = sanitizeLatex(text);
        }
        div.id = `msg-${Date.now()}`;
        chatMessages.appendChild(div);
        chatMessages.scrollTop = chatMessages.scrollHeight;
        renderMath(div);
        return div.id;
    }

    function start(solution) {
        if (!solution || !solution.steps) return;

        currentSolution = solution;


        const hasAnimation = solution.steps.some(s => s.animation && s.animation.type !== 'none');
        if (!hasAnimation) {
            overlay.style.display = 'flex';
            showGeneratePrompt();
            return;
        }


        slides = [];
        solution.steps.forEach((step, index) => {

            slides.push({
                type: 'equation',
                content: step.math,
                explanation: step.explanation,
                title: step.title,
                stepIndex: index
            });


            if (step.animation && step.animation.type !== 'none') {
                slides.push({
                    type: 'action',
                    content: step.animation.latex,
                    text: step.animation.text,
                    stepIndex: index
                });
            }


            if (index === solution.steps.length - 1) {
                slides.push({
                    type: 'equation',
                    content: step.result,
                    explanation: "Final Answer",
                    title: "Result",
                    stepIndex: index,
                    isFinal: true
                });
            }
        });

        currentSlideIndex = 0;
        overlay.style.display = 'flex';
        updateProgress();
        renderSlide(currentSlideIndex);
    }

    function showGeneratePrompt() {
        stage.innerHTML = '';
        instructionBox.classList.remove('visible');
        progressBar.style.width = '0%';

        const container = document.createElement('div');
        container.style.textAlign = 'center';
        container.innerHTML = `
            <div style="font-size: 20px; margin-bottom: 24px;">No animations found for this solution.</div>
            <p style="color: var(--text-secondary); margin-bottom: 32px;">Would you like AI to generate step-by-step animations?</p>
            <button class="btn-primary" id="genAnimBtn">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right:8px">
                    <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
                </svg>
                Generate Animations
            </button>
            <div id="genAnimLoading" style="display:none; margin-top: 20px;">
                <div class="loading-spinner small" style="margin: 0 auto;">
                    <div class="spinner-ring"></div>
                </div>
                <p style="margin-top:10px; font-size:14px; color:var(--text-muted);">Generating magic...</p>
            </div>
        `;
        stage.appendChild(container);

        document.getElementById('genAnimBtn').addEventListener('click', generateAnimations);
    }

    async function generateAnimations() {
        const btn = document.getElementById('genAnimBtn');
        const loading = document.getElementById('genAnimLoading');

        if (btn) btn.style.display = 'none';
        if (loading) loading.style.display = 'block';

        try {
            const problem = document.getElementById('mathInput').value || '';

            const response = await fetch('/mathnote/api/animate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    problem: problem,
                    steps: currentSolution.steps,
                    lang: document.documentElement.getAttribute('data-lang') || 'en'
                })
            });

            const data = await response.json();
            if (!response.ok) throw new Error(data.error);


            const hasAnimation = data.steps.some(s => s.animation && s.animation.type !== 'none');

            if (hasAnimation) {

                start({ ...currentSolution, steps: data.steps });
            } else {
                if (loading) loading.innerHTML = `<p style="color:var(--text-secondary)">AI couldn't animate this specific solution.</p>`;
                setTimeout(() => {

                    if (btn) btn.style.display = 'inline-flex';
                    if (loading) loading.style.display = 'none';
                }, 2500);
            }

        } catch (err) {
            console.error('Gen Animation Error:', err);
            if (loading) loading.innerHTML = `<p style="color:var(--error)">Failed to generate animations.</p>`;
            setTimeout(() => {

            }, 2000);
        }
    }

    function closeOverlay() {
        overlay.style.display = 'none';
        currentSolution = null;
        stage.innerHTML = '';
        instructionBox.textContent = '';
    }

    function nextStep() {
        if (currentSlideIndex < slides.length - 1) {
            currentSlideIndex++;
            renderSlide(currentSlideIndex);
            updateProgress();
        } else {
            closeOverlay();
        }
    }

    function prevStep() {
        if (currentSlideIndex > 0) {
            currentSlideIndex--;
            renderSlide(currentSlideIndex);
            updateProgress();
        }
    }

    function replayStep() {
        renderSlide(currentSlideIndex);
    }

    function updateProgress() {
        const total = slides.length;
        const progress = ((currentSlideIndex + 1) / total) * 100;
        progressBar.style.width = `${progress}%`;

        prevBtn.disabled = currentSlideIndex === 0;
        nextBtn.title = currentSlideIndex === total - 1 ? "Finish" : "Next";
    }

    function renderSlide(index) {
        const slide = slides[index];


        stage.innerHTML = '';
        instructionBox.classList.remove('visible');
        instructionBox.innerHTML = ''; // Use innerHTML to allow rendered math

        const el = document.createElement('div');
        el.className = 'anim-el';

        if (slide.type === 'equation') {

            el.textContent = ensureDelimiters(sanitizeLatex(slide.content));
            el.style.fontSize = '32px';
            if (slide.isFinal) el.style.color = 'var(--accent-primary)';

            instructionBox.innerHTML = sanitizeLatex(slide.explanation || slide.title);
            renderMath(instructionBox);
            instructionBox.classList.add('visible');

        } else if (slide.type === 'action') {

            const wrapper = document.createElement('div');
            wrapper.style.display = 'flex';
            wrapper.style.flexDirection = 'column';
            wrapper.style.alignItems = 'center';
            wrapper.style.justifyContent = 'center';


            const contextEl = document.createElement('div');
            contextEl.textContent = ensureDelimiters(sanitizeLatex(currentSolution.steps[slide.stepIndex].math));
            contextEl.style.fontSize = '24px';
            contextEl.style.opacity = '0.5';
            contextEl.style.marginBottom = '20px';
            wrapper.appendChild(contextEl);
            renderMath(contextEl);


            const actionEl = document.createElement('div');
            actionEl.textContent = ensureDelimiters(sanitizeLatex(slide.content)); // e.g. "+ 5"
            actionEl.style.fontSize = '48px';
            actionEl.style.fontWeight = 'bold';
            actionEl.style.color = 'var(--accent-secondary)';
            wrapper.appendChild(actionEl);
            renderMath(actionEl);

            stage.appendChild(wrapper);

            instructionBox.innerHTML = sanitizeLatex(slide.text);
            renderMath(instructionBox);
            instructionBox.classList.add('visible');


            actionEl.style.opacity = '0';
            actionEl.style.transform = 'scale(0.8)';
            void actionEl.offsetWidth;
            actionEl.style.transition = 'all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)';
            actionEl.style.opacity = '1';
            actionEl.style.transform = 'scale(1)';

            return;
        }

        stage.appendChild(el);
        renderMath(el);


        el.style.opacity = '0';
        el.style.transform = 'scale(0.9)';
        void el.offsetWidth;
        el.style.transition = 'all 0.4s ease-out';
        el.style.opacity = '1';
        el.style.transform = 'scale(1)';
    }

    function renderMath(el) {
        if (window.renderMathInElement) {
            renderMathInElement(el, {
                delimiters: [
                    { left: '$$', right: '$$', display: true },
                    { left: '$', right: '$', display: false }
                ],
                throwOnError: false
            });
        }
    }

    function sanitizeLatex(text) {
        if (!text) return '';

        // Step 1: Convert #COLOR-X ... #!COLOR-X markers to \textcolor{x}{...}
        // These are safe plain-text markers with no JSON escaping issues.
        const COLOR_MAP = {
            'RED':    'red',
            'BLUE':   'blue',
            'GREEN':  'green',
            'ORANGE': 'orange',
            'PURPLE': 'purple',
            'CYAN':   'cyan',
            'TEAL':   'teal',
            'PINK':   'pink',
        };
        Object.entries(COLOR_MAP).forEach(([marker, katexColor]) => {
            const re = new RegExp(`#COLOR-${marker}\\s*([\\s\\S]*?)\\s*#!COLOR-${marker}`, 'g');
            text = text.replace(re, (_, content) => `\\textcolor{${katexColor}}{${content.trim()}}`);
        });

        // Step 2: Convert #LATEX ... #!LATEX markers to $ ... $ for KaTeX
        let sanitized = text.replace(/#LATEX\s*([\s\S]*?)\s*#!LATEX/g, (_, latex) => {
            return `$${latex.trim()}$`;
        });

        // Step 3: Fix double-escaped backslashes from JSON (\\color -> \color)
        sanitized = sanitized.replace(/\\\\/g, '\\');

        // Step 4: Fix begin/end blocks
        sanitized = sanitized.replace(/([^\\])end\{/g, '$1\\end{');
        sanitized = sanitized.replace(/([^\\])begin\{/g, '$1\\begin{');

        return sanitized;
    }

    function ensureDelimiters(text) {
        if (!text) return '';
        const trimmed = text.trim();
        if (trimmed.startsWith('$$') && trimmed.endsWith('$$')) return trimmed;
        if (trimmed.startsWith('$') && trimmed.endsWith('$')) return trimmed;
        if (trimmed.startsWith('\\(') && trimmed.endsWith('\\)')) return trimmed;
        if (trimmed.startsWith('\\[') && trimmed.endsWith('\\]')) return trimmed;


        if (trimmed.includes('\\') || trimmed.includes('^') || trimmed.includes('_') || trimmed.includes('{') || trimmed.includes('=')) {

            const clean = trimmed.replace(/^\$+|\$+$/g, '');
            return `$$${clean}$$`;
        }
        return trimmed;
    }

    return { init, start };
})();

window.AnimationModule = AnimationModule;
