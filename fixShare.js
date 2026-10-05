const fs = require('fs');
const file = 'src/app/reports/contractors-daily-diary/page.tsx';
let content = fs.readFileSync(file, 'utf8');

const target =             const canvas = await html2canvas(element, { scale: 2, useCORS: true, logging: false });
            
            // Restore inputs
            replacements.forEach(({ original, wrapper }) => {
                original.style.display = '';
                wrapper.remove();
            });
            element.className = originalClass;;

const replacement =             let canvas;
            try {
                canvas = await html2canvas(element, { scale: 2, useCORS: true, logging: false });
            } finally {
                // Restore inputs unconditionally even if html2canvas throws an error
                replacements.forEach(({ original, wrapper }) => {
                    original.style.display = '';
                    if (wrapper.parentNode) wrapper.parentNode.removeChild(wrapper);
                });
                element.className = originalClass;
                
                // Also restore combobox spans just in case
                buttons.forEach(btn => {
                    if (btn instanceof HTMLElement) {
                        const span = btn.querySelector('span');
                        if (span) {
                            span.style.whiteSpace = '';
                            span.style.wordBreak = '';
                        }
                    }
                });
            }
            if (!canvas) throw new Error('Canvas generation failed');;

if (content.includes(target)) {
    content = content.replace(target, replacement);
    fs.writeFileSync(file, content, 'utf8');
    console.log('Fixed handleWhatsAppShare');
} else {
    console.log('Target not found');
}
