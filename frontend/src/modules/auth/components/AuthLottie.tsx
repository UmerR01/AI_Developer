"use client";

import {
  AiDeveloperScene1CreateProject,
  AiDeveloperScene2ChatTyping,
  AiDeveloperScene3FileGeneration,
} from "../../../components/AiDeveloperAnimations";

const animations = [
  AiDeveloperScene1CreateProject,
  AiDeveloperScene2ChatTyping,
  AiDeveloperScene3FileGeneration,
];

interface AuthLottieProps {
  activeIndex: number;
}

export function AuthLottie({ activeIndex }: AuthLottieProps) {
  const ActiveAnimation = animations[activeIndex % animations.length];

  return (
    <div className="auth-lottie-wrap">
      <div className="auth-lottie-switcher" key={activeIndex}>
        <ActiveAnimation />
      </div>
    </div>
  );
}
