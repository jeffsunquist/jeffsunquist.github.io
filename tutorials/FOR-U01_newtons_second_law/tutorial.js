export default {
  title: "F = ma: a crate on a frictionless floor",
  subtitle: "Tutorial FOR-U01 · Forces, Lesson 3 · FOR-37, FOR-38",
  grade: "G6+G7",
  lo: ["FOR-37", "FOR-38"],
  scene: {
    width: 640,
    height: 380,
    objects: [
      { id: "ground", kind: "ground", y: 365 },
      { id: "crate", kind: "box", x: 250, y: 200, w: 130, h: 80, label: "4 kg" },
      { id: "push", kind: "arrow", x: 380, y: 226, dx: 132, dy: 0, color: "amber", label: "push 12 N", hidden: true },
      { id: "weight", kind: "arrow", x: 315, y: 280, dx: 0, dy: 60, color: "red", label: "weight", hidden: true },
      { id: "normal", kind: "arrow", x: 315, y: 200, dx: 0, dy: -60, color: "green", label: "normal", hidden: true },
      { id: "net", kind: "arrow", x: 380, y: 262, dx: 132, dy: 0, color: "purple", label: "net 12 N", hidden: true },
      { id: "accel", kind: "arrow", x: 380, y: 318, dx: 95, dy: 0, color: "teal", label: "a", hidden: true }
    ]
  },
  steps: [
    {
      text: "A 4 kg crate sits on a frictionless floor. You push it to the right with 12 N. What is its acceleration?"
    },
    {
      text: "Start with the quantities you know: the mass is 4 kg and the push is 12 N to the right.",
      scene: { push: { hidden: false } }
    },
    {
      text: "Draw the forces on the crate: the push, the weight, and the normal force from the floor. The floor is frictionless, so there is no friction.",
      scene: { weight: { hidden: false }, normal: { hidden: false } }
    },
    {
      text: "The weight and the normal force are vertical and equal, so they cancel. That leaves the 12 N push as the net force.",
      equation: "F_{\\text{net}} = 12\\ \\mathrm{N}\\ \\text{to the right}",
      scene: { net: { hidden: false } }
    },
    {
      text: "Newton's second law connects the net force on an object to its acceleration.",
      equation: "F_{\\text{net}} = ma"
    },
    {
      text: "Solve the equation for the acceleration, then substitute the values with their units.",
      equation: "a = \\frac{F_{\\text{net}}}{m} = \\frac{12\\ \\mathrm{N}}{4\\ \\mathrm{kg}} = 3\\ \\mathrm{m/s^2}",
      scene: { accel: { hidden: false } }
    },
    {
      text: "Check the answer: the acceleration points along the net force (to the right), and newtons divided by kilograms give m/s\u00b2.",
      equation: "\\boxed{a = 3\\ \\mathrm{m/s^2}\\ \\text{to the right}}"
    }
  ]
}
