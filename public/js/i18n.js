
const translations = {
    en: {

        saved: 'Saved',


        solver: 'Solver',
        graphing: 'Graphing',


        enterProblem: 'Enter your math problem',
        classLevel: 'Class Level',
        classLevelPlaceholder: 'e.g. Algebra 1, Statistics...',
        solve: 'Solve Step by Step',
        solving: 'Solving your problem...',


        solution: 'Solution',
        finalAnswer: 'Final Answer',
        save: 'Save',
        whatDoesThisMean: 'What does this mean?',
        explainStep: '💡 What does this mean?',
        verified: '✓ Verified',
        unverified: '⚠ Needs Review',
        incorrect: '✕ Issues Found',
        verifying: 'Verifying...',


        equationMode: 'Equation Mode',
        pointMode: 'Point Mode',
        enterEquation: 'Enter equation (e.g. y = x² + 2x - 1)',
        plot: 'Plot',
        clickToAddPoints: 'Click on the graph to add points, or enter manually below',
        polynomialDegree: 'Polynomial Degree',
        clearPoints: 'Clear Points',
        fitCurve: 'Fit Curve',
        analyzeWithAI: 'Analyze with AI',
        graphAnalysis: 'Graph Analysis',
        addPoint: 'Add Point',
        askAILabel: 'Ask AI about this graph',
        askAI: 'Ask AI',
        askAIPlaceholder: 'e.g. Find the roots, describe the behavior, find the area under the curve...',
        instructionLabel: 'Additional instructions (optional)',
        instructionPlaceholder: 'e.g. Solve by factoring, Find the derivative, Simplify...',


        savedProblems: 'Saved Problems',
        noSavedProblems: 'No saved problems yet',
        load: 'Load',
        delete: 'Delete',


        errorSolving: 'Failed to solve the problem. Please try again.',
        errorExplaining: 'Failed to explain the step. Please try again.',
        errorNoProblem: 'Please enter a math problem first.',
        errorPlotting: 'Failed to plot the equation. Please check the format.',
        animate: 'Animate',
        errorCoordinates: 'Please enter valid X and Y coordinates',
        errorAIQuestion: 'Please enter a question for AI',
        rateLimit: '⏳ Rate limit reached — please wait {secs}s before solving again.',
        savedSuccess: 'Problem saved!',
        deletedSuccess: 'Problem deleted.',


        wordProblem: 'Word Problem',
        enterWordProblem: 'Enter your word problem',
        wordProblemPlaceholder: 'e.g. A train leaves the station at 3 PM traveling at 60 mph...',
    },

    vi: {

        saved: 'Đã lưu',


        solver: 'Giải toán',
        graphing: 'Đồ thị',


        enterProblem: 'Nhập bài toán của bạn',
        classLevel: 'Cấp độ',
        classLevelPlaceholder: 'VD: Đại số 1, Thống kê...',
        solve: 'Giải từng bước',
        solving: 'Đang giải bài toán...',


        solution: 'Lời giải',
        finalAnswer: 'Đáp án',
        save: 'Lưu',
        whatDoesThisMean: 'Điều này có nghĩa gì?',
        explainStep: '💡 Điều này có nghĩa gì?',
        verified: '✓ Đã xác minh',
        unverified: '⚠ Cần kiểm tra',
        incorrect: '✕ Phát hiện lỗi',
        verifying: 'Đang xác minh...',


        equationMode: 'Phương trình',
        pointMode: 'Điểm',
        enterEquation: 'Nhập phương trình (VD: y = x² + 2x - 1)',
        plot: 'Vẽ',
        clickToAddPoints: 'Nhấn vào đồ thị để thêm điểm, hoặc nhập thủ công bên dưới',
        polynomialDegree: 'Bậc đa thức',
        clearPoints: 'Xóa điểm',
        fitCurve: 'Vẽ đường cong',
        analyzeWithAI: 'Phân tích bằng AI',
        graphAnalysis: 'Phân tích đồ thị',
        addPoint: 'Thêm điểm',
        askAILabel: 'Hỏi AI về đồ thị này',
        askAI: 'Hỏi AI',
        askAIPlaceholder: 'VD: Tìm nghiệm, mô tả đồ thị, tính diện tích dưới đường cong...',
        instructionLabel: 'Hướng dẫn thêm (tùy chọn)',
        instructionPlaceholder: 'VD: Giải bằng phân tích, Tìm đạo hàm, Đơn giản hóa...',


        savedProblems: 'Bài toán đã lưu',
        noSavedProblems: 'Chưa có bài toán nào được lưu',
        load: 'Tải',
        delete: 'Xóa',


        errorSolving: 'Không thể giải bài toán. Vui lòng thử lại.',
        errorExplaining: 'Không thể giải thích bước này. Vui lòng thử lại.',
        errorNoProblem: 'Vui lòng nhập bài toán trước.',
        errorPlotting: 'Không thể vẽ phương trình. Vui lòng kiểm tra lại.',
        animate: 'Hoạt họa',
        errorCoordinates: 'Vui lòng nhập tọa độ X và Y hợp lệ',
        errorAIQuestion: 'Vui lòng nhập câu hỏi cho AI',
        rateLimit: '⏳ Đã đạt giới hạn — vui lòng chờ {secs} giây trước khi thử lại.',
        savedSuccess: 'Đã lưu bài toán!',
        deletedSuccess: 'Đã xóa bài toán.',


        wordProblem: 'Bài toán chữ',
        enterWordProblem: 'Nhập bài toán chữ của bạn',
        wordProblemPlaceholder: 'VD: Một đoàn tàu rời ga lúc 3 giờ chiều với vận tốc 60 dặm/giờ...',
    }
};

let currentLang = localStorage.getItem('mathnote-lang') || 'en';

function t(key) {
    return translations[currentLang]?.[key] || translations['en']?.[key] || key;
}

function applyTranslations() {

    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        el.textContent = t(key);
    });


    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
        const key = el.getAttribute('data-i18n-placeholder');
        el.placeholder = t(key);
    });


    const langLabel = document.getElementById('langLabel');
    if (langLabel) langLabel.textContent = currentLang.toUpperCase();


    document.documentElement.setAttribute('lang', currentLang);
    document.documentElement.setAttribute('data-lang', currentLang);
}

function toggleLanguage() {
    currentLang = currentLang === 'en' ? 'vi' : 'en';
    localStorage.setItem('mathnote-lang', currentLang);
    applyTranslations();
}
