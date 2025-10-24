const sum10numbers = () => {
  let result = 0;
  for (let i = 1; i <= 10; i++) {
    result += i;
  }
  return result;
};

const multiple3 = () => {
  const result = [];
  for (let i = 1; i <= 20; i++) {
    if (i % 3 === 0) result.push(i);
  }
  return result;
};

const evenOdd = () => {
  const even = [];
  const odd = [];
  for (let i = 1; i <= 10; i++) {
    if (i % 2 === 0) even.push(i);
    else odd.push(i);
  }
  return [even, odd];
};

const isGraduate = () => {
  const students = [
    { name: "A", grade: 90 },
    { name: "B", grade: 95 },
    { name: "C", grade: 92 },
    { name: "D", grade: 80 },
    { name: "E", grade: 85 },
    { name: "F", grade: 75 },
    { name: "G", grade: 55 },
    { name: "H", grade: 100 },
    { name: "I", grade: 76 },
    { name: "J", grade: 82 },
  ];
  const graduates = [];
  for (let i = 0; i < students.length; i++) {
    if (students[i].grade >= 70) {
      graduates.push(students[i]);
    }
  }
  return graduates;
};
