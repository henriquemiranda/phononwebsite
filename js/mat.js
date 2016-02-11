function matrix_inverse(a)
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

//from http://jsperf.com/ie-3x3-matrix-multiply
function matrix_multiply(m1, m2) {
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
    [m1_0_0 * m2_0_0 + m1_0_1 * m2_1_0 + m1_0_2 * m2_2_0, m1_0_0 * m2_0_1 + m1_0_1 * m2_1_1 + m1_0_2 * m2_2_1, m1_0_0 * m2_0_2 + m1_0_1 * m2_1_2 + m1_0_2 * m2_2_2], [m1_1_0 * m2_0_0 + m1_1_1 * m2_1_0 + m1_1_2 * m2_2_0, m1_1_0 * m2_0_1 + m1_1_1 * m2_1_1 + m1_1_2 * m2_2_1, m1_1_0 * m2_0_2 + m1_1_1 * m2_1_2 + m1_1_2 * m2_2_2], [m1_2_0 * m2_0_0 + m1_2_1 * m2_1_0 + m1_2_2 * m2_2_0, m1_2_0 * m2_0_1 + m1_2_1 * m2_1_1 + m1_2_2 * m2_2_1, m1_2_0 * m2_0_2 + m1_2_1 * m2_1_2 + m1_2_2 * m2_2_2]
  ];
}


function matrix_transpose(a)
{
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

function matrix_scale(a,scale) {
  return [a[0].map(function(x) {return x*scale}),
          a[1].map(function(x) {return x*scale}),
          a[2].map(function(x) {return x*scale})];
}

function matrix_determinant(a) {
  return a[0][0] * (a[1][1] * a[2][2] - a[1][2] * a[2][1])
       + a[0][1] * (a[1][2] * a[2][0] - a[1][0] * a[2][2])
       + a[0][2] * (a[1][0] * a[2][1] - a[1][1] * a[2][0]);
}

function vec_norm(a) {
  return Math.sqrt(a[0]*a[0]+a[1]*a[1]+a[2]*a[2]);
}

function vec_scale(a) {
  return [a[0],a[1],a[2]];
}

function red_car(a,lat) {
  var x=a[0]; y=a[1]; z=a[2];
  return [x*lat[0][0] + y*lat[1][0] + z*lat[2][0],
          x*lat[0][1] + y*lat[1][1] + z*lat[2][1],
          x*lat[0][2] + y*lat[1][2] + z*lat[2][2]]

}

function dist(a,b) {
  x = a[0]-b[0];
  y = a[1]-b[1];
  z = a[2]-b[2];
  return Math.sqrt(x*x + y*y + z*z);
}
