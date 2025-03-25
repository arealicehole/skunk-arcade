# System Patterns

## Architecture Overview

```mermaid
flowchart TD
    A[App Container] --> B[Arcade Cabinet UI]
    B --> C[Game Selection]
    B --> D[Game Container]
    D --> E[Game Engine]
    E --> F[Game Instance]
    F --> G[Game State]
    F --> H[Renderer]
    F --> I[Input Handler]
```

## Core Components

### Arcade Cabinet
- Retro-styled container for all games
- Handles game selection and transitions
- Manages global arcade state

### Game Engine
- Base class for all games
- Manages game loop
- Handles input processing
- Controls rendering pipeline

### Snake Game Implementation
- Extends base game engine
- Custom stink trail mechanics
- Skunk-themed graphics
- Score tracking

## Design Patterns

### Game Loop Pattern
```mermaid
flowchart LR
    A[Input] --> B[Update]
    B --> C[Render]
    C --> A
```

### Component Hierarchy
```mermaid
flowchart TD
    A[ArcadeCabinet] --> B[GameSelection]
    A --> C[GameContainer]
    C --> D[SnakeGame]
    D --> E[GameCanvas]
    D --> F[ScoreDisplay]
    D --> G[Controls]
```

### State Management
- Game state isolated per game
- Shared arcade state for global features
- Score persistence

## Asset Management
- Centralized asset loading
- Pixel art sprite system
- Audio management
- Texture atlases

## Responsive Design
- Arcade cabinet scales with viewport
- Game canvas maintains aspect ratio
- Touch controls for mobile
- Keyboard controls for desktop 