import type { FrameworkAdapter } from "./base.js";

const isWin = process.platform === "win32";
const venvBin = isWin ? "venv\\Scripts" : "venv/bin";
const python = isWin ? "python" : "python3";
const venvPython = isWin ? `${venvBin}\\python` : `${venvBin}/python`;
const venvPip = isWin ? `${venvBin}\\pip` : `${venvBin}/pip`;
const venvDjangoAdmin = isWin ? `${venvBin}\\django-admin` : `${venvBin}/django-admin`;

export const djangoAdapter: FrameworkAdapter = {
  id: "django",
  name: "Django",
  language: "python",
  scaffoldCommands: [
    `${python} -m venv venv`,
    `${venvPip} install django djangorestframework django-cors-headers python-dotenv`,
    `${venvDjangoAdmin} startproject config .`,
    `${venvPython} manage.py startapp core`,
  ],
  buildCommand: `${venvPython} manage.py check --deploy`,
  lintCommand: `${venvPython} -m py_compile manage.py`,
  typecheckCommand: isWin ? "echo Type checking skipped (Python)" : "echo 'Type checking skipped (Python)'",
  devCommand: `${venvPython} manage.py runserver`,
  devPort: 8000,
  designSupport: false,
  packageManager: "pip",
  requiredFiles: ["manage.py", "config/settings.py", "config/urls.py", "requirements.txt"],

  buildPromptAdditions: `
FOR DJANGO:
- Use Django 5.x with Django REST Framework for APIs
- Class-Based Views for CRUD, function-based views for custom logic
- Use Django models with proper field types, validators, and Meta classes
- Migrations: always run makemigrations + migrate after model changes
- URL patterns in config/urls.py, app-level urls in each app's urls.py
- Use Django templates (Jinja-style) for server-rendered pages
- Static files in static/, templates in templates/
- Settings: use python-dotenv for environment variables
- Always create a superuser: python manage.py createsuperuser --noinput
  (set DJANGO_SUPERUSER_USERNAME, DJANGO_SUPERUSER_PASSWORD, DJANGO_SUPERUSER_EMAIL)
- Register models in admin.py for Django Admin access
- Use django-cors-headers for API CORS configuration

PLATFORM NOTE:
- On Windows, use venv\\Scripts\\python instead of venv/bin/python
- On Unix/macOS, use venv/bin/python
- Detect the platform and use the correct path

SECURITY:
- CSRF protection enabled by default — don't disable it
- Use Django's built-in auth system (User model, login/logout views)
- Set DEBUG=False in production settings
- Configure ALLOWED_HOSTS properly

AFTER WRITING CODE:
1. Run: ${venvPython} manage.py makemigrations
2. Run: ${venvPython} manage.py migrate
3. Run: ${venvPython} manage.py check --deploy
4. Fix any warnings or errors before proceeding

ALWAYS generate a requirements.txt with: ${venvPip} freeze > requirements.txt
`.trim(),

  designPromptAdditions: `
DJANGO DESIGN:
- No Storybook — Django uses server-rendered templates
- Design phase is skipped for Django projects
- Focus on clean, functional UI with Django templates + CSS
`.trim(),

  fileStructure: `
config/
├── __init__.py
├── settings.py              # Django settings
├── urls.py                  # Root URL configuration
├── wsgi.py                  # WSGI entry point
└── asgi.py                  # ASGI entry point
core/
├── __init__.py
├── admin.py                 # Admin registrations
├── apps.py                  # App config
├── models.py                # Database models
├── views.py                 # Views (CBV/FBV)
├── urls.py                  # App URL patterns
├── serializers.py           # DRF serializers
├── forms.py                 # Django forms
├── tests.py                 # Tests
├── migrations/
│   └── __init__.py
└── templates/
    └── core/                # App templates
static/
├── css/
├── js/
└── images/
templates/
└── base.html                # Base template
manage.py                    # Django CLI
requirements.txt             # Python dependencies
.env                         # Environment variables
`.trim(),
};
