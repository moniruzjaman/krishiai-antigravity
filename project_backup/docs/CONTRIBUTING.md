# Contributing to Krishi AI

Thank you for your interest in contributing to Krishi AI! This document provides guidelines and instructions for contributing to the project.

## 📋 Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Project Structure](#project-structure)
- [Coding Standards](#coding-standards)
- [Commit Guidelines](#commit-guidelines)
- [Pull Request Process](#pull-request-process)
- [Testing](#testing)
- [Documentation](#documentation)

## 🤝 Code of Conduct

### Our Pledge

We are committed to providing a welcoming and inspiring community for all. Please be respectful and constructive in your interactions.

### Our Standards

- ✅ Be respectful and inclusive
- ✅ Provide constructive feedback
- ✅ Focus on what is best for the community
- ✅ Show empathy towards others

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ and npm
- Python 3.11+
- Git
- Code editor (VS Code recommended)

### Fork and Clone

1. Fork the repository on GitHub
2. Clone your fork locally:

```bash
git clone https://github.com/YOUR_USERNAME/krishiai.git
cd krishiai
```

1. Add upstream remote:

```bash
git remote add upstream https://github.com/moniruzjaman/krishiai.git
```

## 💻 Development Setup

### Frontend Setup

```bash
cd krishi-ai-2.0
npm install
cp .env.example .env
# Add your API keys to .env
npm run dev
```

### Backend Setup

```bash
cd krishi-ai-backend
python -m venv venv
venv\Scripts\activate  # Windows
pip install -r requirements.txt
cp .env.example .env
# Configure your .env
python -m uvicorn app.main:app --reload
```

## 📁 Project Structure

```
krishiai/
├── krishi-ai-2.0/          # Frontend
│   ├── components/         # React components
│   ├── services/           # API services
│   ├── types.ts            # TypeScript types
│   └── App.tsx             # Main app
│
├── krishi-ai-backend/      # Backend
│   ├── app/
│   │   ├── routes/         # API routes
│   │   ├── services/       # Business logic
│   │   └── main.py         # FastAPI app
│   └── requirements.txt
│
└── docs/                   # Documentation
```

## 📝 Coding Standards

### TypeScript/React (Frontend)

#### File Naming

- Components: `PascalCase.tsx` (e.g., `Analyzer.tsx`)
- Services: `camelCase.ts` (e.g., `geminiService.ts`)
- Types: `types.ts` or `ComponentName.types.ts`

#### Code Style

```typescript
// ✅ Good
interface AnalyzerProps {
  onBack?: () => void;
  lang: Language;
}

export const Analyzer: React.FC<AnalyzerProps> = ({ onBack, lang }) => {
  const [loading, setLoading] = useState(false);
  
  return (
    <div className="container">
      {/* Component content */}
    </div>
  );
};

// ❌ Avoid
export default function Analyzer(props: any) {
  // Avoid 'any' types
  // Avoid default exports for components
}
```

#### Best Practices

- ✅ Use TypeScript strict mode
- ✅ Define proper interfaces for props
- ✅ Use functional components with hooks
- ✅ Implement error boundaries
- ✅ Add loading states
- ✅ Handle edge cases

### Python (Backend)

#### File Naming

- Modules: `snake_case.py` (e.g., `gemini_service.py`)
- Classes: `PascalCase`
- Functions: `snake_case`

#### Code Style

```python
# ✅ Good
from typing import Optional
from pydantic import BaseModel

class CropAnalysisRequest(BaseModel):
    image_data: str
    crop_type: Optional[str] = None
    
async def analyze_crop(request: CropAnalysisRequest) -> dict:
    """
    Analyze crop image for diseases.
    
    Args:
        request: Analysis request with image data
        
    Returns:
        Analysis results dictionary
    """
    try:
        # Implementation
        return {"status": "success"}
    except Exception as e:
        logger.error(f"Analysis failed: {e}")
        raise

# ❌ Avoid
def analyze(data):  # Missing type hints
    return data  # No error handling
```

#### Best Practices

- ✅ Use type hints
- ✅ Add docstrings
- ✅ Handle exceptions properly
- ✅ Use async/await for I/O operations
- ✅ Follow PEP 8 style guide
- ✅ Use Pydantic for validation

## 📝 Commit Guidelines

### Commit Message Format

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Types

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting)
- `refactor`: Code refactoring
- `test`: Adding tests
- `chore`: Maintenance tasks

### Examples

```bash
# Good commits
feat(analyzer): add voice input support
fix(weather): correct geolocation permission handling
docs(readme): update installation instructions
refactor(services): extract common API logic

# Bad commits
update code
fix bug
changes
```

## 🔄 Pull Request Process

### Before Submitting

1. **Update from upstream**:

```bash
git fetch upstream
git rebase upstream/main
```

1. **Run tests**:

```bash
# Frontend
cd krishi-ai-2.0
npm run build
npx tsc --noEmit

# Backend
cd krishi-ai-backend
python -m pytest
```

1. **Check code style**:

```bash
# Frontend
npx prettier --check .

# Backend
black --check .
flake8 .
```

### Submitting PR

1. Push to your fork:

```bash
git push origin feature/your-feature-name
```

1. Create PR on GitHub with:
   - Clear title and description
   - Reference related issues
   - Screenshots/videos for UI changes
   - Test results

2. Wait for review and address feedback

### PR Checklist

- [ ] Code follows project style guidelines
- [ ] Tests pass locally
- [ ] Documentation updated
- [ ] No console errors/warnings
- [ ] Commits are clean and descriptive
- [ ] PR description is clear

## 🧪 Testing

### Frontend Testing

```bash
cd krishi-ai-2.0

# Type checking
npx tsc --noEmit

# Build verification
npm run build

# Manual testing
npm run dev
# Test in browser at http://localhost:5173
```

### Backend Testing

```bash
cd krishi-ai-backend

# Run tests
python -m pytest

# Check coverage
pytest --cov=app

# Manual testing
python -m uvicorn app.main:app --reload
# Test at http://localhost:8000/docs
```

### Testing Checklist

#### Frontend

- [ ] Component renders correctly
- [ ] Props are handled properly
- [ ] Error states work
- [ ] Loading states work
- [ ] Responsive on mobile
- [ ] Accessibility (ARIA labels)

#### Backend

- [ ] Endpoint returns correct status codes
- [ ] Request validation works
- [ ] Error handling is proper
- [ ] Response format is correct
- [ ] Authentication works (if applicable)

## 📚 Documentation

### Code Documentation

#### TypeScript

```typescript
/**
 * Analyzes crop image for diseases and pests.
 * 
 * @param base64Data - Base64 encoded image data
 * @param options - Analysis options
 * @returns Promise with analysis results
 * @throws Error if API call fails
 */
export const analyzeCropImage = async (
  base64Data: string,
  options?: AnalysisOptions
): Promise<AnalysisResult> => {
  // Implementation
};
```

#### Python

```python
async def analyze_crop(
    image_data: str,
    crop_type: Optional[str] = None
) -> dict:
    """
    Analyze crop image for diseases.
    
    Args:
        image_data: Base64 encoded image
        crop_type: Optional crop type for context
        
    Returns:
        Dictionary with analysis results
        
    Raises:
        ValueError: If image_data is invalid
        APIError: If external API call fails
    """
    pass
```

### Documentation Updates

When adding features, update:

- [ ] README.md (if public-facing)
- [ ] API.md (for backend changes)
- [ ] Component comments (for UI changes)
- [ ] Type definitions (for data structure changes)

## 🎯 Areas for Contribution

### High Priority

- 🐛 Bug fixes
- 📝 Documentation improvements
- ♿ Accessibility enhancements
- 🌐 Localization (more languages)

### Medium Priority

- ✨ New features
- 🎨 UI/UX improvements
- ⚡ Performance optimizations
- 🧪 Test coverage

### Good First Issues

Look for issues labeled `good-first-issue` or `help-wanted`

## ❓ Questions?

- Open an issue for bugs
- Start a discussion for feature requests
- Join our community chat (if available)
- Email: <support@krishiai.live>

## 📄 License

By contributing, you agree that your contributions will be licensed under the MIT License.

---

Thank you for contributing to Krishi AI! 🌾
