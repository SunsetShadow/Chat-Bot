import type { AvatarModelConfig } from "@/types/avatar";

export const haruConfig: AvatarModelConfig = {
  id: "haru",
  name: "Haru",
  modelUrl: "/live2d/haru_greeter_t03.model3.json",
  params: {
    mouthOpenY: "ParamMouthOpenY",
    mouthForm: "ParamMouthForm",
    eyeLOpen: "ParamEyeLOpen",
    eyeROpen: "ParamEyeROpen",
    angleX: "ParamAngleX",
    angleY: "ParamAngleY",
    breath: "ParamBreath",
    bodyAngleX: "ParamBodyAngleX",
  },
  expressions: {
    neutral: 0,
    happy: 1,
    sad: 2,
    angry: 3,
    surprised: 4,
    sympathetic: 5,
    thinking: 6,
    excited: 7,
  },
  motions: {
    idle: { count: 3, randomInterval: [10000, 20000] },
    tap: { count: 5 },
  },
};
