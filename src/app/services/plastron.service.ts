import {Injectable} from '@angular/core';
import {LogService} from './log.service';
import {Zone} from '../models/zone';
import {Impact} from '../models/impact';
import {OpencvImshowService} from './opencv-imshow.service';

class PointCv {
  constructor(public x: number = -1, public y: number = -1) {
  }
}

export class Cible {
  constructor(public impacts: Impact[] = [], public image: any = null) {
  }
}

@Injectable({
  providedIn: 'root',
})
export class PlastronService {
  get cv(): any {
    if (this._cv === undefined) {
      // @ts-ignore
      return top['cv'];
    }
    return this._cv;
  }

  private _cv: any;

  private frame: any = null;

  private PICTURE_SIZE_SHEET_DETECTION: number = 1000;

  private impactColor: any = null;

  constructor(
    private logger: LogService,
    private opencvImshowService: OpencvImshowService
  ) {
  }

  // UTILS FUNCTIONS ##########
  toRadians = (degrees: number) => {
    this.logger.debug('start toRadians');
    this.logger.debug('end toRadians');
    return (degrees * Math.PI) / 180;
  };

  rotatePoint(center: PointCv, point: PointCv, angle: number) {
    const s = Math.sin(angle);
    const c = Math.cos(angle);

    // Translate point back to origin:
    const translatedX = point.x - center.x;
    const translatedY = point.y - center.y;

    // Rotate point
    const rotatedX = translatedX * c - translatedY * s;
    const rotatedY = translatedX * s + translatedY * c;

    // Translate point back:
    point.x = rotatedX + center.x;
    point.y = rotatedY + center.y;

    return point;
  }

  getPointOnEllipse(
    center: PointCv,
    radiusX: number,
    radiusY: number,
    angle: number
  ) {
    const x = center.x + Math.cos(angle) * radiusX;
    const y = center.y + Math.sin(angle) * radiusY;
    return new this.cv.Point(x, y);
  }

  growEllipse(ellipse: any, factor: number) {
    ellipse.size.width *= factor;
    ellipse.size.height *= factor;
    return ellipse;
  }

  private getDistance(p1: PointCv, p2: PointCv) {
    return Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2));
  }

  getAngle(p1: PointCv, p2: PointCv) {
    this.logger.debug('start getAngle');
    this.logger.debug('end getAngle');
    return Math.atan2(p2.y - p1.y, p2.x - p1.x);
  }

  getRealDistance(center: PointCv, border: PointCv, impact: PointCv) {
    const length = this.getDistance(center, border);
    const distance = this.getDistance(center, impact);
    const percent = distance / length;
    const realLength = 25;
    const milimeterDistance = realLength * percent;
    return Math.round(milimeterDistance);
  }

  getPoints(distance: number) {
    let point = 570;
    let i = 0;
    if (distance > this.maximumImpactDistance) {
      return 0;
    }
    for (; i < 5 && distance > 0; i++) {
      point -= 6;
      distance -= 1;
    }
    for (; i < 48 && distance > 0; i++) {
      point -= 3;
      distance -= 1;
    }
    return point;
  }

  // ##########################

  // GET SHEET COORDINATES ####

  enhancedImageForEdgeDetection(im: any, blurRadius: number) {
    this.logger.debug('start preprocess');
    let value = new this.cv.Mat();
    this.cv.cvtColor(im, value, this.cv.COLOR_BGR2HSV);
    let hsvChannels = new this.cv.MatVector();
    this.cv.split(value, hsvChannels);

    value = hsvChannels.get(2);
    hsvChannels.delete();
    if (blurRadius !== 0) {
      this.cv.medianBlur(value, value, blurRadius);
    }
    this.logger.debug('end preprocess');
    return value;
  }

  getEdges(
    image: any,
    blurRadius: number = 0,
    cannyThreshold1: number = 100,
    cannyThreshold2: number = 200
  ) {
    this.logger.debug('start getEdges');
    let imageClone = image.clone();
    if (blurRadius > 0) {
      this.cv.blur(
        imageClone,
        imageClone,
        new this.cv.Size(blurRadius, blurRadius)
      );
    }
    let edges = new this.cv.Mat();
    this.cv.Canny(imageClone, edges, cannyThreshold1, cannyThreshold2);
    this.logger.debug('end getEdges');
    return edges;
  }

  getBiggestValidContour(contours: any[]) {
    for (let contour of contours) {
      let approxDistance = this.cv.arcLength(contour, true) * 0.1;
      let approx = new this.cv.Mat();
      this.cv.approxPolyDP(contour, approx, approxDistance, true);
      let valid = true;
      if (approx.total() === 4) {
        let angles = [];
        for (let i = 0; i < 4; i++) {
          let p1 = {
            x: approx.data32F[i * 2],
            y: approx.data32F[i * 2 + 1],
          };
          let p2 = {
            x: approx.data32F[((i + 1) % 4) * 2],
            y: approx.data32F[((i + 1) % 4) * 2 + 1],
          };
          let p3 = {
            x: approx.data32F[((i + 2) % 4) * 2],
            y: approx.data32F[((i + 2) % 4) * 2 + 1],
          };
          let dx1 = p1.x - p2.x;
          let dy1 = p1.y - p2.y;
          let dx2 = p3.x - p2.x;
          let dy2 = p3.y - p2.y;
          let angle = Math.abs(
            (Math.atan2(dx1 * dy2 - dy1 * dx2, dx1 * dx2 + dy1 * dy2) * 180) /
            Math.PI
          );
          angles.push(angle);
        }

        for (let angle of angles) {
          if (angle < 70 || angle > 110) {
            valid = false;
            break;
          }
        }

        let area = this.cv.contourArea(approx);
        let ratio =
          area /
          (this.PICTURE_SIZE_SHEET_DETECTION *
            this.PICTURE_SIZE_SHEET_DETECTION);
        if (ratio < 0.1) {
          valid = false;
        }
        if (ratio > 0.7) {
          valid = false;
        }

        if (valid) {
          return approx;
        }
        approx.delete();
      }
    }
  }

  coordinatesToPercentage(
    coordinates: { x: any; y: any }[],
    width: number,
    height: number
  ) {
    let percentageCoordinates = [];
    for (let coordinate of coordinates) {
      percentageCoordinates.push({
        x: coordinate.x / width,
        y: coordinate.y / height,
      });
    }
    return percentageCoordinates;
  }

  private orderPoints(pts: PointCv[]) {
    let rect = new Array(4);
    let pts2 = [...pts];

    pts2.sort((a, b) => a.x + a.y - (b.x + b.y));
    rect[0] = pts2[0];
    rect[2] = pts2[pts2.length - 1];

    pts2.sort((a, b) => a.x - a.y - (b.x - b.y));
    rect[3] = pts2[0];
    rect[1] = pts2[pts2.length - 1];

    return rect;
  }

  getBiggestContour(contours: any) {
    this.logger.debug('start getBiggestContour');
    let maxArea = 0;
    let biggestContour = null;
    let contoursArray = [];
    for (let i = 0; i < contours.size(); i++) {
      contoursArray.push(contours.get(i));
    }
    for (let contour of contoursArray) {
      const boundingRect = this.cv.boundingRect(contour);
      const area = boundingRect.width * boundingRect.height;
      if (area > maxArea) {
        maxArea = area;
        biggestContour = contour;
      }
    }
    this.logger.debug('end getBiggestContour');
    return biggestContour;
  }

  getSheetCoordinates(mat: any) {
    // Enhance image for edge detection
    this.opencvImshowService.showImage(mat, 'original', 'original');

    let contours = new this.cv.MatVector();
    let hierarchy = new this.cv.Mat();
    this.cv.findContours(
      mat,
      contours,
      hierarchy,
      this.cv.RETR_CCOMP,
      this.cv.CHAIN_APPROX_SIMPLE
    );
    let contoursArray = [];
    for (let i = 0; i < contours.size(); i++) {
      contoursArray.push(contours.get(i));
    }
    contoursArray.sort(
      (contour1, contour2) =>
        this.cv.contourArea(contour1) - this.cv.contourArea(contour2)
    );
    const biggestContour = this.getBiggestValidContour(contoursArray);

    contours.delete();
    hierarchy.delete();

    if (!biggestContour) {
      return null;
    }

    let topLeft = {
      x: biggestContour.data32S[0],
      y: biggestContour.data32S[1],
    };
    let topLeftIndex = 0;
    let minDistance = this.getDistance(topLeft, new this.cv.Point(0, 0));

    for (let i = 1; i < biggestContour.total(); i++) {
      let distance = this.getDistance(
        {
          x: biggestContour.data32S[i * 2],
          y: biggestContour.data32S[i * 2 + 1],
        },
        new this.cv.Point(0, 0)
      );
      if (distance < minDistance) {
        minDistance = distance;
        topLeftIndex = i;
      }
    }

    let firstHalf = [];
    for (let i = 0; i < topLeftIndex; i++) {
      firstHalf.push({
        x: biggestContour.data32S[i * 2],
        y: biggestContour.data32S[i * 2 + 1],
      });
    }

    let secondHalf = [];
    for (let i = topLeftIndex; i < biggestContour.total(); i++) {
      secondHalf.push({
        x: biggestContour.data32S[i * 2],
        y: biggestContour.data32S[i * 2 + 1],
      });
    }

    let concat = firstHalf.concat(secondHalf);
    concat = this.coordinatesToPercentage(
      concat,
      mat.cols,
      mat.rows
    );
    console.log(concat);
    biggestContour.delete();
    return this.orderPoints(concat);
  }

  // ########################## EXTRACTION DE L'IMAGE DE LA CIBLE ####

  percentToCoordinates(percent: any, width: number, height: number) {
    let coordinates = [];
    for (let percentageCoordinate of percent) {
      coordinates.push({
        x: Math.round(percentageCoordinate.x * width),
        y: Math.round(percentageCoordinate.y * height),
      });
    }
    return coordinates;
  }

  getSheetPicture(mat: any) {
    this.logger.debug('start getPlastronMat');
    this.opencvImshowService.showImage(mat, 'test', 'test');
    let coordinates = this.getSheetCoordinates(mat);
    if (coordinates === null) {
      return mat;
    }
    coordinates = this.percentToCoordinates(coordinates, mat.cols, mat.rows);
    console.log('coordinates', coordinates);
    const sourceCoordinates = [
      [coordinates[0].x, coordinates[0].y],
      [coordinates[1].x, coordinates[1].y],
      [coordinates[2].x, coordinates[2].y],
      [coordinates[3].x, coordinates[3].y],
    ];

    let approx = this.cv.matFromArray(
      4,
      1,
      this.cv.CV_32FC2,
      sourceCoordinates.flat()
    );

    const destCoordinates = [
      [0, 0],
      [mat.cols - 1, 0],
      [mat.cols - 1, mat.rows - 1],
      [0, mat.rows - 1],
    ];

    const matFromArray = this.cv.matFromArray(
      4,
      1,
      this.cv.CV_32FC2,
      destCoordinates.flat()
    );
    let transform = this.cv.getPerspectiveTransform(approx, matFromArray);

    let warped = new this.cv.Mat();
    this.cv.warpPerspective(mat, warped, transform, mat.size());
    this.cv.resize(warped, warped, new this.cv.Size(1500, 1500));
    this.logger.debug('end getPlastronMat');
    approx.delete();
    return warped;
  }

  private readonly maximumImpactDistance = 48;

  getImpactsCenters(mat: any): PointCv[] {
    this.logger.debug('start getImpactsCenters');
    const points: PointCv[] = [];
    if (this.impactColor !== null) {
      const impactsMask = this.getColorMask(mat, this.impactColor);
      this.logger.debug('getImpactsCenters impactsMask', impactsMask);
      const kernel = this.cv.Mat.ones(3, 3, this.cv.CV_8UC1);
      this.cv.dilate(
        impactsMask,
        impactsMask,
        kernel,
        new this.cv.Point(-1, -1),
        1
      );
      const contours = new this.cv.MatVector();
      const tempMat = new this.cv.Mat();
      this.cv.findContours(
        impactsMask,
        contours,
        tempMat,
        this.cv.RETR_LIST,
        this.cv.CHAIN_APPROX_SIMPLE
      );

      this.logger.debug('getImpactsCenters contours', contours);
      let contoursArray = [];
      for (let i = 0; i < contours.size(); i++) {
        contoursArray.push(contours.get(i));
      }
      for (const contour of contoursArray) {
        if (contour.size().height < 5) {
          continue;
        }
        this.logger.debug('getImpactsCenters contour', contour);
        const impact = this.cv.fitEllipse(contour);
        points.push(impact.center);
      }
      kernel.delete();
      tempMat.delete();
      impactsMask.delete();
      contours.delete();
    }
    this.logger.debug('end getImpactsCenters');
    return points;
  }

  autoBrightnessAndContrast(mat: any, clipHistPercent: number) {
    let gray = new this.cv.Mat();
    this.cv.cvtColor(mat, gray, this.cv.COLOR_BGR2GRAY);

    let hist = new this.cv.Mat();
    let histSize = new this.cv.Mat(256, 1, this.cv.CV_32SC1);
    let histRange = new this.cv.Mat(1, 2, this.cv.CV_32FC1);
    histRange.data32F.set([0, 256]);
    this.logger.debug('start calcHist');

    const matVector = new this.cv.MatVector();
    matVector.push_back(gray);
    const mat1 = new this.cv.Mat();
    this.cv.calcHist(matVector, [0], mat1, hist, histSize, histRange);
    mat1.delete();
    matVector.delete();

    this.logger.debug('end calcHist');

    let histSizeTotal = hist.total();
    let accumulator = new this.cv.Mat();
    this.cv.reduce(hist, accumulator, 0, this.cv.REDUCE_SUM, -1);

    let maximum = accumulator.data32F[histSizeTotal - 1];
    clipHistPercent *= maximum / 100.0;
    clipHistPercent /= 2.0;

    let minimumGray = 0;
    while (accumulator.data32F[minimumGray] < clipHistPercent) {
      minimumGray++;
    }

    let maximumGray = histSizeTotal - 1;
    while (accumulator.data32F[maximumGray] >= maximum - clipHistPercent) {
      maximumGray--;
    }

    let range = maximumGray - minimumGray;
    if (range === 0) {
      gray.delete();
      hist.delete();
      histSize.delete();
      histRange.delete();
      accumulator.delete();
      return mat;
    }

    let alpha = 255 / range;
    let beta = -minimumGray * alpha;

    let autoResult = new this.cv.Mat();
    mat.convertTo(autoResult, -1, alpha, beta);

    // Libérer la mémoire des objets Mat
    gray.delete();
    hist.delete();
    histSize.delete();
    histRange.delete();
    accumulator.delete();
    autoResult.delete();

    return autoResult;
  }

  getOuterCircle(mat: any) {
    this.logger.debug('start getOuterCircle');

    let circle = new this.cv.Mat(
      mat.cols,
      mat.rows,
      this.cv.CV_8UC1,
      new this.cv.Scalar(0, 0, 0)
    );
    this.cv.circle(
      circle,
      new this.cv.Point(mat.cols / 2, mat.rows / 2),
      mat.cols / 2.2,
      new this.cv.Scalar(255, 255, 255),
      -1
    );

    let kernelSize = 5; // Size of the kernel matrix
    let kernelData = Array(kernelSize).fill(Array(kernelSize).fill(1)); // Create a 2D array filled with ones

    // Convert the kernel data to a cv.Mat object
    let kernel = this.cv.matFromArray(
      kernelSize,
      kernelSize,
      this.cv.CV_32F,
      kernelData.flat()
    );

    let removeHoles = mat.clone();
    if (this.impactColor != null) {
      let redDots = this.getColorMask(mat, this.impactColor);
      this.cv.dilate(redDots, redDots, kernel, new this.cv.Point(-1, -1), 1);
      this.cv.bitwise_not(redDots, redDots);
      let mask3 = new this.cv.Mat(
        mat.size().width,
        mat.size().height,
        this.cv.CV_8UC3,
        [0, 0, 0, 255]
      );
      this.cv.cvtColor(redDots, mask3, this.cv.COLOR_GRAY2BGR);
      redDots.delete();
      mask3.delete();
    }

    let hsv = new this.cv.Mat();
    this.cv.cvtColor(removeHoles, hsv, this.cv.COLOR_BGR2HSV);

    let hsvChannels = new this.cv.MatVector();
    this.cv.split(hsv, hsvChannels);

    let value = hsvChannels.get(2);

    let value_mask = new this.cv.Mat();
    let minMaxLocResult = this.cv.minMaxLoc(value);
    let max =
      (minMaxLocResult.maxVal - minMaxLocResult.minVal) / 2 +
      minMaxLocResult.minVal;

    const min = new this.cv.Scalar(minMaxLocResult.minVal);
    const high = new this.cv.Scalar(max);

    let minMat = new this.cv.Mat(value.rows, value.cols, value.type(), min);
    let highMat = new this.cv.Mat(value.rows, value.cols, value.type(), high);
    this.opencvImshowService.showImage(value, 'value', 'value');
    this.cv.inRange(value, minMat, highMat, value_mask);
    minMat.delete();
    highMat.delete();
    this.opencvImshowService.showImage(value_mask, 'value_mask', 'value_mask');
    this.cv.bitwise_and(value_mask, circle, value_mask);
    let close = new this.cv.Mat();
    this.cv.morphologyEx(value_mask, close, this.cv.MORPH_CLOSE, kernel);
    this.opencvImshowService.showImage(close, 'close1', 'close1');
    value_mask.delete();
    this.cv.morphologyEx(
      close,
      close,
      this.cv.MORPH_OPEN,
      kernel,
      new this.cv.Point(-1, -1),
      1
    );
    this.opencvImshowService.showImage(close, 'close2', 'close2');

    let open = new this.cv.Mat();
    let kernelSize2 = 30; // Size of the kernel matrix
    let kernelData2 = Array(kernelSize2).fill(Array(kernelSize2).fill(1)); // Create a 2D array filled with ones
    let kernel2 = this.cv.matFromArray(
      kernelSize2,
      kernelSize2,
      this.cv.CV_32F,
      kernelData2.flat()
    );
    let contours = new this.cv.MatVector();
    this.cv.findContours(
      close,
      contours,
      new this.cv.Mat(),
      this.cv.RETR_EXTERNAL,
      this.cv.CHAIN_APPROX_SIMPLE
    );
    let biggestContour = this.getBiggestContour(contours);
    if (biggestContour == null) {
      hsv.delete();
      hsvChannels.delete();
      kernel.delete();
      circle.delete();
      close.delete();
      open.delete();
      kernel2.delete();
      throw new Error('Problème lors de la détection des visuels');
    }
    const biggestContourVector = new this.cv.MatVector();
    biggestContourVector.push_back(biggestContour);

    this.cv.drawContours(
      close,
      biggestContourVector,
      -1,
      new this.cv.Scalar(255, 255, 255),
      -1
    );
    biggestContourVector.delete();
    open = close.clone();

    this.opencvImshowService.showImage(open, 'close', 'close');
    let newContours = new this.cv.MatVector();
    const mat2 = new this.cv.Mat();
    this.cv.findContours(
      open,
      newContours,
      mat2,
      this.cv.RETR_EXTERNAL,
      this.cv.CHAIN_APPROX_SIMPLE
    );
    mat2.delete();

    biggestContour = this.getBiggestContour(newContours);
    if (biggestContour == null || biggestContour.size().height < 5) {
      hsv.delete();
      hsvChannels.delete();
      kernel.delete();
      circle.delete();
      close.delete();
      open.delete();
      newContours.delete();
      biggestContour.delete();
      kernel2.delete();
      throw new Error('Problème lors de la détection des visuels');
    }
    const mat3 = new this.cv.Mat(biggestContour);
    let ellipse = this.cv.fitEllipse(mat3);
    mat3.delete();
    // Nettoyage des contours
    for (let i = 0; i < 10; i++) {
      let empty = new this.cv.Mat.zeros(mat.size(), mat.type());
      let center = new this.cv.Point(ellipse.center.x, ellipse.center.y);
      let axes = new this.cv.Size(
        ellipse.size.width / 2,
        ellipse.size.height / 2
      );
      let angle = ellipse.angle;
      let startAngle = 0;
      let endAngle = 360;
      let color = new this.cv.Scalar(255, 255, 255);
      let thickness = this.cv.FILLED;
      let lineType = this.cv.LINE_8;
      console.log('ellipse', ellipse);
      this.cv.ellipse(
        empty,
        center,
        axes,
        angle,
        startAngle,
        endAngle,
        color,
        thickness,
        lineType
      );
      this.cv.circle(mat, ellipse.center, 2, [255, 0, 0, 255], -1);
      this.cv.cvtColor(empty, empty, this.cv.COLOR_BGR2GRAY);

      let xor = new this.cv.Mat();
      this.cv.bitwise_xor(empty, open, xor);
      this.opencvImshowService.showImage(xor, 'open' + i, 'open' + i);
      this.cv.bitwise_or(open, xor, xor);

      let xorContours = new this.cv.MatVector();
      const mat1 = new this.cv.Mat();
      this.cv.findContours(
        xor,
        xorContours,
        mat1,
        this.cv.RETR_EXTERNAL,
        this.cv.CHAIN_APPROX_SIMPLE
      );

      biggestContour = this.getBiggestContour(xorContours);
      mat1.delete();
      xorContours.delete();
      empty.delete();
      xor.delete();
      if (biggestContour == null || biggestContour.size().height < 5) {
        hsv.delete();
        hsvChannels.delete();
        kernel.delete();
        circle.delete();
        close.delete();
        open.delete();
        newContours.delete();
        biggestContour.delete();
        kernel2.delete();
        throw new Error('Problème lors de la détection des visuels');
      }
      const biggestContourMat = new this.cv.Mat(biggestContour);
      ellipse = this.cv.fitEllipse(biggestContourMat);

      biggestContourMat.delete();
      if (
        ellipse.size.width < ellipse.size.height * 0.7 ||
        ellipse.size.width > ellipse.size.height * 1.3
      ) {
        hsv.delete();
        hsvChannels.delete();
        kernel.delete();
        circle.delete();
        close.delete();
        open.delete();
        newContours.delete();
        biggestContour.delete();
        kernel2.delete();

        throw new Error('Problème lors de la détection des visuels');
      }
    }
    let center = new this.cv.Point(ellipse.center.x, ellipse.center.y);
    let axes = new this.cv.Size(
      ellipse.size.width / 2,
      ellipse.size.height / 2
    );
    let angle = ellipse.angle;
    let startAngle = 0;
    let endAngle = 360;
    let color = new this.cv.Scalar(0, 255, 0, 255);
    let thickness = 3;

    this.cv.ellipse(
      mat,
      center,
      axes,
      angle,
      startAngle,
      endAngle,
      color,
      thickness
    );

    hsv.delete();
    hsvChannels.delete();
    kernel.delete();
    circle.delete();
    close.delete();
    open.delete();
    newContours.delete();
    biggestContour.delete();
    kernel2.delete();

    return ellipse;
  }

  getAverageColor(mat: any) {
    this.logger.debug('start getAverageColor');
    let hsv = new this.cv.Mat();
    this.cv.cvtColor(mat, hsv, this.cv.COLOR_BGR2HSV);

    let hsvChannels = new this.cv.MatVector();
    this.cv.split(hsv, hsvChannels);
    let saturation = hsvChannels.get(1);

    let minMaxLocResult = this.cv.minMaxLoc(saturation);
    let min =
      (minMaxLocResult.maxVal - minMaxLocResult.minVal) / 1.05 +
      minMaxLocResult.minVal;

    const lowerBound = new this.cv.Scalar(min);
    const upperBound = new this.cv.Scalar(minMaxLocResult.maxVal);

    let low = new this.cv.Mat(
      saturation.rows,
      saturation.cols,
      saturation.type(),
      lowerBound
    );
    let high = new this.cv.Mat(
      saturation.rows,
      saturation.cols,
      saturation.type(),
      upperBound
    );

    this.cv.inRange(saturation, low, high, saturation);

    this.logger.debug('inRange done');
    let contours = new this.cv.MatVector();
    let hierarchy = new this.cv.Mat();
    this.cv.findContours(
      saturation,
      contours,
      hierarchy,
      this.cv.RETR_EXTERNAL,
      this.cv.CHAIN_APPROX_SIMPLE
    );

    let biggestContour = this.getBiggestContour(contours);
    if (biggestContour == null) {
      return null;
    }
    this.logger.debug('biggestContour done', biggestContour);

    let rect = this.cv.boundingRect(biggestContour);
    let biggestEdge = Math.max(rect.width, rect.height);
    let kernel = this.cv.Mat.ones(
      biggestEdge / 4,
      biggestEdge / 4,
      this.cv.CV_8U
    );
    this.cv.erode(saturation, saturation, kernel, new this.cv.Point(-1, -1), 1);

    let cropped = mat.roi(rect);
    const color = this.cv.mean(cropped);

    // Libérer la mémoire des objets Mat
    hsv.delete();
    hsvChannels.delete();
    saturation.delete();
    contours.delete();
    hierarchy.delete();
    biggestContour.delete();
    kernel.delete();
    cropped.delete();
    low.delete();
    high.delete();

    return color;
  }

  getColorMask(mat: any, color: any) {
    this.logger.debug('start getColorMask');
    const colorMat = new this.cv.Mat(1, 1, this.cv.CV_8UC3, color);
    const hsv = new this.cv.Mat();
    this.cv.cvtColor(colorMat, hsv, this.cv.COLOR_BGR2HSV);

    const min = new this.cv.Scalar(hsv.ucharPtr(0, 0)[0] - 10, 100, 50);
    const max = new this.cv.Scalar(hsv.ucharPtr(0, 0)[0] + 10, 255, 255);
    const mask = new this.cv.Mat();
    const hsvMat = new this.cv.Mat();
    this.cv.cvtColor(mat, hsvMat, this.cv.COLOR_BGR2HSV);
    const hsvChannels = new this.cv.MatVector();
    this.cv.split(hsvMat, hsvChannels);

    let minMat = new this.cv.Mat(hsvMat.rows, hsvMat.cols, hsvMat.type(), min);
    let highMat = new this.cv.Mat(hsvMat.rows, hsvMat.cols, hsvMat.type(), max);

    this.cv.inRange(hsvMat, minMat, highMat, mask);
    const kernel = this.cv.Mat.ones(5, 5, this.cv.CV_8UC1);
    this.cv.morphologyEx(
      mask,
      mask,
      this.cv.MORPH_OPEN,
      kernel,
      new this.cv.Point(-1, -1),
      3
    );
    minMat.delete();
    highMat.delete();
    kernel.delete();
    colorMat.delete();
    hsv.delete();
    hsvMat.delete();
    hsvChannels.delete();
    this.logger.debug('end getColorMask');
    return mask;
  }

  getTopLeftTarget(mat: any) {
    this.logger.debug('start getTopLeftTarget');
    const img = mat.clone();
    const rectCrop = new this.cv.Rect(0, 0, img.cols / 2, img.rows / 2);
    const croppedImage = img.roi(rectCrop);
    img.delete();
    return croppedImage;
  }

  getTopRightTarget(mat: any) {
    const img = mat.clone();
    const rectCrop = new this.cv.Rect(
      img.cols / 2,
      0,
      img.cols / 2,
      img.rows / 2
    );
    const croppedImage = img.roi(rectCrop);
    img.delete();
    return croppedImage;
  }

  getBottomLeftTarget(mat: any) {
    this.logger.debug('start getBottomLeftTarget');
    const img = mat.clone();
    const rectCrop = new this.cv.Rect(
      0,
      img.rows / 2,
      img.cols / 2,
      img.rows / 2
    );
    const croppedImage = img.roi(rectCrop);
    img.delete();
    this.logger.debug('end getBottomLeftTarget');

    return croppedImage;
  }

  toDegrees = (radians: number) => {
    this.logger.debug('start toDegrees');
    this.logger.debug('end toDegrees');
    return radians * (180 / Math.PI);
  };

  process(): Cible {
    this.logger.debug('start process');
    // console.log('process', this.frame);

    let mat = this.getSheetPicture(this.frame);
    this.impactColor = this.getAverageColor(mat);
    console.log('impactColor', this.impactColor);
    let hashMapVisuels = this.getHashMapVisuels(mat);
    let impactPoints = this.getImpactsCenters(mat);
    let result = new Cible();
    for (let zone in hashMapVisuels) {
      let ellipse = hashMapVisuels[zone];
      let center = new this.cv.Point(ellipse.center.x, ellipse.center.y);
      let axes = new this.cv.Size(
        {...ellipse.size}.width / 2,
        {...ellipse.size}.height / 2
      );
      let angle = ellipse.angle;
      let startAngle = 0;
      let endAngle = 360;
      let color = new this.cv.Scalar(0, 0, 255, 255);
      let thickness = 1;
      let lineType = this.cv.LINE_8;

      this.cv.ellipse(
        mat,
        center,
        axes,
        angle,
        startAngle,
        endAngle,
        [255, 0, 0, 255],
        thickness,
        lineType
      );
      let size = {...ellipse.size};
      size.width *= 0.2;
      size.height *= 0.2;
      axes = new this.cv.Size(size.width / 2, size.height / 2);

      this.cv.ellipse(
        mat,
        center,
        axes,
        angle,
        startAngle,
        endAngle,
        color,
        thickness,
        lineType
      );
      size = {...ellipse.size};
      size.width *= 0.6;
      size.height *= 0.6;
      axes = new this.cv.Size(size.width / 2, size.height / 2);

      this.cv.ellipse(
        mat,
        center,
        axes,
        angle,
        startAngle,
        endAngle,
        color,
        thickness,
        lineType
      );
      size = {...ellipse.size};
      size.width *= 1.4;
      size.height *= 1.4;
      axes = new this.cv.Size(size.width / 2, size.height / 2);

      this.cv.ellipse(
        mat,
        center,
        axes,
        angle,
        startAngle,
        endAngle,
        color,
        thickness,
        lineType
      );
      size = {...ellipse.size};
      size.width *= 1.8;
      size.height *= 1.8;
      axes = new this.cv.Size(size.width / 2, size.height / 2);

      this.cv.ellipse(
        mat,
        center,
        axes,
        angle,
        startAngle,
        endAngle,
        color,
        thickness,
        lineType
      );
    }

    this.logger.debug('Impact points :' + impactPoints.length);
    for (let point of impactPoints) {
      this.cv.circle(mat, point, 1, [0, 255, 0, 255], -1);
      let minDistance = Number.MAX_VALUE;
      let closestZone = null;
      this.logger.debug('hashMapVisuels :' + hashMapVisuels);
      for (let zone in hashMapVisuels) {
        let distance = this.getDistance(point, hashMapVisuels[zone].center);
        if (minDistance > distance) {
          minDistance = distance;
          closestZone = zone;
        }
      }
      if (closestZone == null) {
        throw new Error('Aucune zone trouvée');
      }

      let radAngle = this.getAngle(point, hashMapVisuels[closestZone].center);
      let angle = radAngle + this.toRadians(360);
      let ellipseAngle = this.toRadians(
        hashMapVisuels[closestZone].angle + 360
      );
      angle = angle - ellipseAngle;
      let pointOnEllipse = this.getPointOnEllipse(
        hashMapVisuels[closestZone].center,
        hashMapVisuels[closestZone].size.width / 2,
        hashMapVisuels[closestZone].size.height / 2,
        angle
      );
      pointOnEllipse = this.rotatePoint(
        hashMapVisuels[closestZone].center,
        pointOnEllipse,
        ellipseAngle + this.toRadians(180)
      );

      this.logger.debug('pointOnEllipse :', pointOnEllipse);
      this.logger.debug('ellipse :', hashMapVisuels[closestZone]);
      this.logger.debug('mat :', mat);
      this.cv.circle(mat, pointOnEllipse, 2, [255, 0, 0, 255], -1);
      const realDistance = this.getRealDistance(
        hashMapVisuels[closestZone].center,
        pointOnEllipse,
        point
      );
      const points = this.getPoints(realDistance);

      this.cv.putText(
        mat,
        String(points),
        point,
        this.cv.FONT_HERSHEY_SIMPLEX,
        1,
        [0, 0, 0, 255],
        4
      );
      this.cv.putText(
        mat,
        String(points),
        point,
        this.cv.FONT_HERSHEY_SIMPLEX,
        1,
        [255, 255, 255, 255],
        2
      );
      let impactDTO = {
        id: result.impacts.length,
        zone: closestZone as Zone,
        score: points,
        angle: this.toDegrees(radAngle) + 180,
        distance: realDistance,
        amount: 0,
      };
      result.impacts.push(impactDTO);
    }

    result.image = mat;
    this.logger.debug('end process');
    this.logger.debug(result);
    return result;
  }

  getHashMapVisuels(mat: any) {
    this.logger.debug('getHashMapVisuels');
    this.logger.debug('getTopLeftTarget');
    const topLeftTarget = this.getTopLeftTarget(mat);
    let ellipseTopLeft = this.getOuterCircle(topLeftTarget);
    topLeftTarget.delete();
    this.logger.debug('getTopRightTarget');
    const topRightTarget = this.getTopRightTarget(mat);
    let ellipseTopRight = this.getOuterCircle(topRightTarget);
    topRightTarget.delete();
    const width = mat.cols;
    ellipseTopRight.center.x += width / 2;
    this.logger.debug('getCenterTarget');
    const centerTarget = this.getCenterTarget(mat);
    let ellipseCenter = this.getOuterCircle(centerTarget);
    centerTarget.delete();
    ellipseCenter.center.x += mat.cols / 4;
    const height = mat.rows;
    ellipseCenter.center.y += height / 4;
    this.logger.debug('getBottomLeftTarget');
    const bottomLeftTarget = this.getBottomLeftTarget(mat);
    let ellipseBottomLeft = this.getOuterCircle(bottomLeftTarget);
    bottomLeftTarget.delete();
    ellipseBottomLeft.center.y += height / 2;
    this.logger.debug('getBottomRightTarget');
    const bottomRightTarget = this.getBottomRightTarget(mat);
    let ellipseBottomRight = this.getOuterCircle(bottomRightTarget);
    bottomRightTarget.delete();
    ellipseBottomRight.center.x += width / 2;
    ellipseBottomRight.center.y += height / 2;
    let ellipseMap: any = {};
    ellipseMap[Zone.TOP_LEFT] = ellipseTopLeft;
    ellipseMap[Zone.TOP_RIGHT] = ellipseTopRight;
    ellipseMap[Zone.CENTER] = ellipseCenter;
    ellipseMap[Zone.BOTTOM_LEFT] = ellipseBottomLeft;
    ellipseMap[Zone.BOTTOM_RIGHT] = ellipseBottomRight;
    this.logger.debug('end getHashMapVisuels');
    return ellipseMap;
  }

  getBottomRightTarget(mat: any) {
    this.logger.debug('start getBottomRightTarget');
    const img = mat.clone();
    const rectCrop = new this.cv.Rect(
      img.cols / 2,
      img.rows / 2,
      img.cols / 2,
      img.rows / 2
    );
    const croppedImage = img.roi(rectCrop);
    img.delete();
    this.logger.debug('end getBottomRightTarget');
    return croppedImage;
  }

  getCenterTarget(mat: any) {
    this.logger.debug('start getCenterTarget');
    const img = mat.clone();
    const rectCrop = new this.cv.Rect(
      img.cols / 4,
      img.rows / 4,
      img.cols / 2,
      img.rows / 2
    );
    const croppedImage = img.roi(rectCrop);
    img.delete();
    this.logger.debug('end getCenterTarget');
    return croppedImage;
  }

  setFrame(frame: any) {
    this.logger.debug('setFrame', frame);
    this.frame?.delete();
    this.frame = frame;
  }

  getFrame() {
    this.logger.debug('getFrame', this.frame);
    return this.frame;
  }
}
