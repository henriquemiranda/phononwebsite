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

function matrix_determinant(a) {
  return a[0][0] * (a[1][1] * a[2][2] - a[1][2] * a[2][1])
       + a[0][1] * (a[1][2] * a[2][0] - a[1][0] * a[2][2])
       + a[0][2] * (a[1][0] * a[2][1] - a[1][1] * a[2][0]);
}

function vec_norm(a) {
  return Math.sqrt(a[0]*a[0]+a[1]*a[1]+a[2]*a[2]);
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
