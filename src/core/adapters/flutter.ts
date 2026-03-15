import type { FrameworkAdapter } from "./base.js";

const isWin = process.platform === "win32";

export const flutterAdapter: FrameworkAdapter = {
  id: "flutter",
  name: "Flutter",
  language: "dart",
  scaffoldCommands: [
    "flutter create --org com.forge --platforms web,android,ios .",
  ],
  buildCommand: "flutter build web",
  lintCommand: "dart analyze",
  typecheckCommand: "dart analyze",
  devCommand: "flutter run -d chrome",
  devPort: 8080,
  designSupport: false,
  packageManager: "pub",
  requiredFiles: ["pubspec.yaml", "lib/main.dart"],
  testCommand: "flutter test",
  testFramework: "Flutter Test",

  buildPromptAdditions: `
FOR FLUTTER:
- Use Dart 3 with null safety throughout
- Material Design 3 (Material You) as the default design system
- Use StatelessWidget when possible, StatefulWidget only when needed
- Prefer Riverpod or Provider for state management
- Use go_router for navigation/routing
- Follow the feature-first folder structure (not layer-first)
- Small, focused widgets (< 100 lines per file)
- Extract reusable widgets to lib/widgets/
- Use const constructors wherever possible for performance

DART BEST PRACTICES:
- Use final for immutable variables, var only when mutation is needed
- Named parameters for widget constructors: Widget({required this.title})
- Use records and patterns (Dart 3): switch expressions, if-case, sealed classes
- Proper async/await with error handling (try/catch, .catchError)
- Use freezed or json_serializable for data models
- Extension methods for utility functions
- Typedef for complex function signatures

UI PATTERNS:
- Responsive layouts: LayoutBuilder, MediaQuery, or responsive_framework
- Use Theme.of(context) for consistent theming
- Custom color schemes with ColorScheme.fromSeed()
- Adaptive design: different layouts for mobile/tablet/desktop
- Hero animations for navigation transitions
- Slivers for complex scrolling layouts (CustomScrollView, SliverAppBar)

NETWORKING:
- Use dio or http package for API calls
- Repository pattern for data access
- Model classes with fromJson/toJson

ASSETS:
- Put images in assets/images/
- Put fonts in assets/fonts/
- Register assets in pubspec.yaml
- Use flutter_svg for SVG support
- App icon: flutter_launcher_icons package

AFTER WRITING CODE:
1. Run: dart analyze — fix all issues
2. Run: flutter test — run all tests
3. Run: flutter build web — verify build works

PLATFORM NOTE:
- Primary target is web, but code should be platform-agnostic
- Use kIsWeb from dart:foundation for web-specific code
- Avoid dart:html — use universal_html or conditional imports
`.trim(),

  designPromptAdditions: `
FLUTTER DESIGN:
- No Storybook — Flutter uses widget previews
- Design phase is skipped for Flutter projects
- Focus on Material Design 3 with custom theming
- Use WidgetBook package if interactive component previews are needed
`.trim(),

  fileStructure: `
lib/
├── main.dart                  # App entry point
├── app.dart                   # MaterialApp / root widget
├── router.dart                # go_router configuration
├── theme/
│   ├── app_theme.dart         # ThemeData + ColorScheme
│   └── text_styles.dart       # Typography
├── features/
│   └── [feature]/
│       ├── screens/           # Full-page widgets
│       ├── widgets/           # Feature-specific widgets
│       ├── models/            # Data models
│       ├── providers/         # Riverpod providers
│       └── repositories/     # Data access
├── widgets/
│   └── [shared_widget].dart   # Reusable widgets
├── models/
│   └── [model].dart           # Shared data models
├── services/
│   └── api_client.dart        # HTTP client
└── utils/
    └── extensions.dart        # Extension methods
test/
├── widget_test.dart           # Widget tests
└── [feature]_test.dart        # Feature tests
assets/
├── images/
└── fonts/
pubspec.yaml                   # Dependencies
analysis_options.yaml          # Linter rules
`.trim(),
};
