export const pi = 3.14159265359

export function matrix_inverse(a)
{
    det = matrix_determinant(a);
    var c = [[0,0,0],[0,0,0],[0,0,0]];

    c[0][0] = (a[1][1] * a[2][2] - a[1][2] * a[2][1]) / det;
    c[1][0] = (a[1][2] * a[2][0] - a[1][0] * a[2][2]) / det;
    c[2][0] = (a[1][0] * a[2][1] - a[1][1] * a[2][0]) / det;
    c[0][1] = (a[2][1] * a[0][2] - a[2][2] * a[0][1]) / det;
    c[1][1] = (a[2][2] * a[0][0] - a[2][0] * a[0][2]) / det;
    c[2][1] = (a[2][0] * a[0][1] - a[2][1] * a[0][0]) / det;
    c[0][2] = (a[0][1] * a[1][2] - a[0][2] * a[1][1]) / det;
    c[1][2] = (a[0][2] * a[1][0] - a[0][0] * a[1][2]) / det;
    c[2][2] = (a[0][0] * a[1][1] - a[0][1] * a[1][0]) / det;

    return c;
}

/*
from http://jsperf.com/ie-3x3-matrix-multiply
*/
export function matrix_multiply(m1, m2) {
    var m1_0 = m1[0];
    var m1_1 = m1[1];
    var m1_2 = m1[2];
    var m2_0 = m2[0];
    var m2_1 = m2[1];
    var m2_2 = m2[2];

    var m1_0_0 = m1_0[0];
    var m1_0_1 = m1_0[1];
    var m1_0_2 = m1_0[2];
    var m1_1_0 = m1_1[0];
    var m1_1_1 = m1_1[1];
    var m1_1_2 = m1_1[2];
    var m1_2_0 = m1_2[0];
    var m1_2_1 = m1_2[1];
    var m1_2_2 = m1_2[2];

    var m2_0_0 = m2_0[0];
    var m2_0_1 = m2_0[1];
    var m2_0_2 = m2_0[2];
    var m2_1_0 = m2_1[0];
    var m2_1_1 = m2_1[1];
    var m2_1_2 = m2_1[2];
    var m2_2_0 = m2_2[0];
    var m2_2_1 = m2_2[1];
    var m2_2_2 = m2_2[2];

    return [
    [m1_0_0 * m2_0_0 + m1_0_1 * m2_1_0 + m1_0_2 * m2_2_0,
     m1_0_0 * m2_0_1 + m1_0_1 * m2_1_1 + m1_0_2 * m2_2_1,
     m1_0_0 * m2_0_2 + m1_0_1 * m2_1_2 + m1_0_2 * m2_2_2],
    [m1_1_0 * m2_0_0 + m1_1_1 * m2_1_0 + m1_1_2 * m2_2_0,
     m1_1_0 * m2_0_1 + m1_1_1 * m2_1_1 + m1_1_2 * m2_2_1,
     m1_1_0 * m2_0_2 + m1_1_1 * m2_1_2 + m1_1_2 * m2_2_2],
    [m1_2_0 * m2_0_0 + m1_2_1 * m2_1_0 + m1_2_2 * m2_2_0,
     m1_2_0 * m2_0_1 + m1_2_1 * m2_1_1 + m1_2_2 * m2_2_1,
     m1_2_0 * m2_0_2 + m1_2_1 * m2_1_2 + m1_2_2 * m2_2_2]];
}


export function matrix_transpose(a) {
  var c = [[0,0,0],[0,0,0],[0,0,0]];

  c[0][0] = a[0][0];
  c[0][1] = a[1][0];
  c[0][2] = a[2][0];
  c[1][0] = a[0][1];
  c[1][1] = a[1][1];
  c[1][2] = a[2][1];
  c[2][0] = a[0][2];
  c[2][1] = a[1][2];
  c[2][2] = a[2][2];
  return c;
}

export function matrix_scale(a,scale) {
  return [a[0].map(function(x) {return x*scale}),
          a[1].map(function(x) {return x*scale}),
          a[2].map(function(x) {return x*scale})];
}

export function matrix_determinant(a) {
    return a[0][0] * (a[1][1] * a[2][2] - a[1][2] * a[2][1])
         + a[0][1] * (a[1][2] * a[2][0] - a[1][0] * a[2][2])
         + a[0][2] * (a[1][0] * a[2][1] - a[1][1] * a[2][0]);
}

export function vec_norm(a) {
    return Math.sqrt(a[0]*a[0]+a[1]*a[1]+a[2]*a[2]);
}

export function vec_scale(a,scale) {
    return [a[0]*scale,a[1]*scale,a[2]*scale];
}

export function vec_dot(a,b) {
    return a[0]*b[0] + a[1]*b[1] + a[2]*b[2];
}

export function vec_cross(a,b) {
    return [a[1]*b[2]-a[2]*b[1],
            a[2]*b[0]-a[0]*b[2],
            a[0]*b[1]-a[1]*b[0]]
}

export function distance(a,b) {
    /* Distance between two points
    */
    let x = a[0]-b[0];
    let y = a[1]-b[1];
    let z = a[2]-b[2];
    return Math.sqrt(x*x + y*y + z*z);
}
