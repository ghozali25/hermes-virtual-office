import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { ROLE_COLORS } from './layout'
import type { AgentRole } from '@/types/agent'

export const HIP_STAND = 0.98

export type Limb = {
  shoulder: THREE.Object3D
  elbow: THREE.Object3D
}

export type Avatar = {
  group: THREE.Group
  badge: THREE.Mesh
  mixer?: THREE.AnimationMixer
  actions?: Record<string, THREE.AnimationAction>
  
  // Dummy bones
  chest: THREE.Object3D
  neck: THREE.Object3D
  head: THREE.Object3D
  hips: THREE.Object3D
  arms: [Limb, Limb]
  legs: [Limb, Limb]
}

const gltfLoader = new GLTFLoader()
let soldierGLTF: any = null

if (typeof window !== 'undefined') {
  gltfLoader.load('/models/Soldier.glb', (gltf) => {
    soldierGLTF = gltf
  })
}

export function buildAvatar(role: AgentRole, skin = 0xe9c19a): Avatar {
  const group = new THREE.Group()
  const accent = ROLE_COLORS[role] ?? 0x6f8fa8

  const badgeGeom = new THREE.CylinderGeometry(0.08, 0.08, 0.04, 16)
  badgeGeom.rotateX(Math.PI / 2)
  const badge = new THREE.Mesh(
    badgeGeom,
    new THREE.MeshStandardMaterial({
      color: accent,
      emissive: accent,
      emissiveIntensity: 0.5,
    }),
  )
  badge.position.set(0, 2.1, 0)
  group.add(badge)

  const dummy = new THREE.Object3D()
  const dummyLimb = { shoulder: dummy, elbow: dummy }
  
  const av: Avatar = {
    group,
    badge,
    chest: dummy,
    neck: dummy,
    head: dummy,
    hips: dummy,
    arms: [dummyLimb, dummyLimb],
    legs: [dummyLimb, dummyLimb]
  }

  if (soldierGLTF) {
    const scene = soldierGLTF.scene.clone()
    scene.scale.set(1.1, 1.1, 1.1)
    
    scene.traverse((child: any) => {
      if (child.isMesh) {
        child.castShadow = true
        child.receiveShadow = true
      }
    })
    group.add(scene)

    const mixer = new THREE.AnimationMixer(scene)
    const actions: Record<string, THREE.AnimationAction> = {}
    
    soldierGLTF.animations.forEach((clip: THREE.AnimationClip) => {
      actions[clip.name] = mixer.clipAction(clip)
    })

    if (actions['Idle']) {
      actions['Idle'].play()
      actions['Idle'].setEffectiveWeight(1)
    }
    if (actions['Walk']) {
      actions['Walk'].play()
      actions['Walk'].setEffectiveWeight(0)
    }

    av.mixer = mixer
    av.actions = actions
  } else {
    const fallback = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 1.8, 0.5),
      new THREE.MeshStandardMaterial({ color: accent })
    )
    fallback.position.y = 0.9
    group.add(fallback)
  }

  return av
}