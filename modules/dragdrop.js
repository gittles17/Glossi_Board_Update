/**
 * Drag and Drop Module
 * Handles file drops, parsing, and content extraction
 */

class DragDropHandler {
  constructor() {
    this.dropZone = null;
    this.dropToggle = null;
    this.onContentDropped = null;
    this.isVisible = false;
  }

  /**
   * Initialize the drag and drop handler
   */
  init(dropZoneEl, dropToggleEl, onContentDropped) {
    this.dropZone = dropZoneEl;
    this.dropToggle = dropToggleEl;
    this.onContentDropped = onContentDropped;

    this.setupEventListeners();
  }

  /**
   * Setup all event listeners
   */
  setupEventListeners() {
    // Toggle button
    this.dropToggle.addEventListener('click', () => this.toggleDropZone());

    // Drop zone events
    this.dropZone.addEventListener('dragover', (e) => this.handleDragOver(e));
    this.dropZone.addEventListener('dragleave', (e) => this.handleDragLeave(e));
    this.dropZone.addEventListener('drop', (e) => this.handleDrop(e));

    // Global drag events (show drop zone when dragging files over window)
    document.addEventListener('dragenter', (e) => this.handleGlobalDragEnter(e));
    document.addEventListener('dragleave', (e) => this.handleGlobalDragLeave(e));
    document.addEventListener('drop', (e) => this.handleGlobalDrop(e));

    // Click outside to close
    document.addEventListener('click', (e) => {
      if (this.isVisible && 
          !this.dropZone.contains(e.target) && 
          !this.dropToggle.contains(e.target)) {
        this.hideDropZone();
      }
    });

    // Escape key to close
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isVisible) {
        this.hideDropZone();
      }
    });
  }

  /**
   * Toggle drop zone visibility
   */
  toggleDropZone() {
    if (this.isVisible) {
      this.hideDropZone();
    } else {
      this.showDropZone();
    }
  }

  /**
   * Show drop zone
   */
  showDropZone() {
    this.isVisible = true;
    this.dropZone.classList.add('visible');
    this.dropToggle.classList.add('active');
  }

  /**
   * Hide drop zone
   */
  hideDropZone() {
    this.isVisible = false;
    this.dropZone.classList.remove('visible', 'drag-over');
    this.dropToggle.classList.remove('active');
  }

  /**
   * Handle drag over
   */
  handleDragOver(e) {
    e.preventDefault();
    e.stopPropagation();
    this.dropZone.classList.add('drag-over');
  }

  /**
   * Handle drag leave
   */
  handleDragLeave(e) {
    e.preventDefault();
    e.stopPropagation();
    
    // Only remove class if leaving the drop zone entirely
    if (!this.dropZone.contains(e.relatedTarget)) {
      this.dropZone.classList.remove('drag-over');
    }
  }

  /**
   * Handle global drag enter (show drop zone when files dragged into window)
   */
  handleGlobalDragEnter(e) {
    e.preventDefault();
    if (e.dataTransfer.types.includes('Files')) {
      this.showDropZone();
    }
  }

  /**
   * Handle global drag leave
   */
  handleGlobalDragLeave(e) {
    e.preventDefault();
    // Check if leaving the window
    if (e.clientX === 0 && e.clientY === 0) {
      this.hideDropZone();
    }
  }

  /**
   * Handle global drop (prevent default browser behavior)
   */
  handleGlobalDrop(e) {
    e.preventDefault();
  }

  /**
   * Handle file drop
   */
  async handleDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    
    this.dropZone.classList.remove('drag-over');
    
    const files = Array.from(e.dataTransfer.files);
    
    if (files.length === 0) {
      // Check for dropped text
      const text = e.dataTransfer.getData('text/plain');
      if (text) {
        await this.processContent(text, 'text/plain', 'Dropped Text');
      }
      return;
    }

    // Process each file
    for (const file of files) {
      await this.processFile(file);
    }

    this.hideDropZone();
  }

  /**
   * Process a dropped file
   */
  async processFile(file) {
    const fileType = this.getFileType(file);
    
    try {
      let content;
      
      switch (fileType) {
        case 'image':
          content = await this.processImage(file);
          break;
        case 'pdf':
          content = await this.processPDF(file);
          break;
        case 'text':
          content = await this.processText(file);
          break;
        default:
          throw new Error(`Unsupported file type: ${file.type}`);
      }

      if (content && this.onContentDropped) {
        await this.onContentDropped({
          type: fileType,
          fileName: file.name,
          content: content,
          file: file
        });
      }
    } catch (error) {
      console.error('Error processing file:', error);
      throw error;
    }
  }

  /**
   * Determine file type
   */
  getFileType(file) {
    const type = file.type.toLowerCase();
    const name = file.name.toLowerCase();

    if (type.startsWith('image/') || /\.(png|jpg|jpeg|gif|webp)$/.test(name)) {
      return 'image';
    }
    if (type === 'application/pdf' || name.endsWith('.pdf')) {
      return 'pdf';
    }
    if (type.startsWith('text/') || /\.(txt|md|markdown)$/.test(name)) {
      return 'text';
    }
    
    // Default to text for unknown types
    return 'text';
  }

  /**
   * Process image file
   */
  async processImage(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = (e) => {
        resolve({
          dataUrl: e.target.result,
          description: `Image: ${file.name}`,
          // We'll send this to Claude for description
          needsAnalysis: true
        });
      };
      
      reader.onerror = () => reject(new Error('Failed to read image'));
      reader.readAsDataURL(file);
    });
  }

  /**
   * Process PDF file using pdf.js
   */
  async processPDF(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = async (e) => {
        try {
          const typedArray = new Uint8Array(e.target.result);
          const pdf = await pdfjsLib.getDocument(typedArray).promise;
          
          let fullText = '';
          
          // Extract text from all pages
          for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();
            const pageText = textContent.items
              .map(item => item.str)
              .join(' ');
            fullText += pageText + '\n\n';
          }

          resolve({
            text: fullText.trim(),
            pageCount: pdf.numPages,
            description: `PDF: ${file.name} (${pdf.numPages} pages)`
          });
        } catch (error) {
          reject(new Error('Failed to parse PDF: ' + error.message));
        }
      };
      
      reader.onerror = () => reject(new Error('Failed to read PDF'));
      reader.readAsArrayBuffer(file);
    });
  }

  /**
   * Process text file
   */
  async processText(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = (e) => {
        resolve({
          text: e.target.result,
          description: `Text: ${file.name}`
        });
      };
      
      reader.onerror = () => reject(new Error('Failed to read text file'));
      reader.readAsText(file);
    });
  }

  /**
   * Process plain text content (not from a file)
   */
  async processContent(text, mimeType, description) {
    if (this.onContentDropped) {
      await this.onContentDropped({
        type: 'text',
        fileName: description,
        content: { text, description }
      });
    }
  }
}

// Export singleton instance
export const dragDropHandler = new DragDropHandler();
export default dragDropHandler;
